-- Hound schema — see artifact/design.md Section 2 for the full field-by-field
-- rationale. Run this against your Supabase project (SQL editor or the CLI)
-- yourself; nothing in this repo runs it for you.

create extension if not exists "pgcrypto";

create table if not exists runs (
  id                uuid primary key default gen_random_uuid(),
  objective         text not null,
  refined_icp       jsonb,
  tool_limits       jsonb,
  status            text not null default 'pending'
                      check (status in ('pending', 'running', 'completed', 'failed', 'declined')),
                      -- 'declined': the request had no company search to run
                      -- (see the icp-refinement skill); status_note holds the
                      -- plain-language reason shown to the user
  status_note       text,
  current_stage     text, -- plain-language pipeline stage for the UI trail;
                          -- not in design.md's original schema — added because
                          -- frontend-design.md's trail needs *something* to
                          -- render against beyond the 4-value `status` enum
  created_by        uuid not null references auth.users (id),
  created_by_email  text not null,
  claude_cost_usd   numeric,
  -- Budget consumption counters, reserved atomically by the functions
  -- below *before* any paid call — never derived by counting `leads` rows,
  -- which only exist after a company is saved (design.md Section 3/4).
  candidates_used        int not null default 0 check (candidates_used >= 0),
  scrapes_used           int not null default 0 check (scrapes_used >= 0),
  discovery_passes_used  int not null default 0 check (discovery_passes_used >= 0),
  idempotency_key   uuid not null unique,
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);

create index if not exists runs_created_by_idx on runs (created_by);
create index if not exists runs_status_idx on runs (status);

create table if not exists leads (
  id                    uuid primary key default gen_random_uuid(),
  run_id                uuid not null references runs (id) on delete cascade,
  company_name          text not null,
  company_domain        text not null,
  linkedin_url          text,  -- the company's LinkedIn page, from discovery
  qualification_status  text not null
                          check (qualification_status in ('qualified', 'not_qualified', 'needs_review')),
  confidence            numeric not null check (confidence between 0 and 1),
  fit_reasons           jsonb not null default '[]'::jsonb,
  concerns              jsonb not null default '[]'::jsonb,
  source_urls           jsonb not null default '[]'::jsonb,
  source_summary        text,
  outreach_sequence     jsonb,
  linkedin_message      text,
  outreach_edited_at    timestamptz,
  outreach_edited_by    uuid references auth.users (id),
  created_at            timestamptz not null default now(),
  unique (run_id, company_domain)
);

create index if not exists leads_run_id_idx on leads (run_id);
create index if not exists leads_qualification_status_idx on leads (qualification_status);

create table if not exists tool_calls (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid not null references runs (id) on delete cascade,
  lead_id         uuid references leads (id) on delete set null,
  tool_name       text not null,
  purpose         text,
  input_summary   jsonb,
  result_summary  jsonb,
  status          text not null check (status in ('success', 'error')),
  error_message   text,
  cost_usd        numeric,
  created_at      timestamptz not null default now()
);

create index if not exists tool_calls_run_id_idx on tool_calls (run_id);
create index if not exists tool_calls_lead_id_idx on tool_calls (lead_id);

-- Budget reservation — design.md Section 3/4. Limits are read from the
-- run's own `tool_limits` snapshot, and each function takes a row lock
-- (or is a single conditional UPDATE), so parallel tool calls or a
-- retried Inngest step can't both spend the same remaining budget.

-- One discovery pass: the first pass gets min(first_pass_candidates,
-- remaining), the re-search gets whatever remains, and nothing beyond
-- max_discovery_passes. `reason` says why `granted` is 0.
create or replace function reserve_discovery(p_run_id uuid)
returns table (granted int, pass_number int, reason text)
language plpgsql
set search_path = public
as $$
declare
  r          runs%rowtype;
  v_max      int;
  v_first    int;
  v_passes   int;
  v_remaining int;
  v_grant    int;
begin
  select * into r from runs where id = p_run_id for update;
  if not found then
    raise exception 'run % not found', p_run_id;
  end if;

  v_max    := (r.tool_limits ->> 'max_candidates')::int;
  v_first  := (r.tool_limits ->> 'first_pass_candidates')::int;
  v_passes := (r.tool_limits ->> 'max_discovery_passes')::int;
  if v_max is null or v_first is null or v_passes is null then
    raise exception 'run % has incomplete tool_limits', p_run_id;
  end if;

  if r.status <> 'running' then
    return query select 0, r.discovery_passes_used, 'search is not running'::text;
    return;
  end if;

  if r.discovery_passes_used >= v_passes then
    return query select 0, r.discovery_passes_used, 'discovery passes exhausted'::text;
    return;
  end if;

  v_remaining := greatest(v_max - r.candidates_used, 0);
  if v_remaining = 0 then
    return query select 0, r.discovery_passes_used, 'candidate budget exhausted'::text;
    return;
  end if;

  v_grant := case when r.discovery_passes_used = 0 then least(v_first, v_remaining) else v_remaining end;

  update runs
     set candidates_used = candidates_used + v_grant,
         discovery_passes_used = discovery_passes_used + 1
   where id = p_run_id;

  return query select v_grant, r.discovery_passes_used + 1, 'ok'::text;
end;
$$;

-- Returns unused candidate budget (the actor returned fewer results than
-- reserved, or the call failed outright). The pass itself stays spent.
create or replace function release_candidates(p_run_id uuid, p_count int)
returns void
language sql
set search_path = public
as $$
  update runs
     set candidates_used = greatest(candidates_used - greatest(p_count, 0), 0)
   where id = p_run_id;
$$;

-- One scrape. True if granted, false if max_scrapes is already reached.
create or replace function reserve_scrape(p_run_id uuid)
returns boolean
language sql
set search_path = public
as $$
  with updated as (
    update runs
       set scrapes_used = scrapes_used + 1
     where id = p_run_id
       and status = 'running'
       and scrapes_used < (tool_limits ->> 'max_scrapes')::int
    returning 1
  )
  select exists (select 1 from updated);
$$;

-- Adds Claude spend to the run as soon as the Agent SDK reports it, so a
-- search that later fails still shows what it cost, and an Inngest retry
-- of the agent step adds its own session's cost instead of overwriting.
create or replace function add_claude_cost(p_run_id uuid, p_amount numeric)
returns void
language sql
set search_path = public
as $$
  update runs
     set claude_cost_usd = coalesce(claude_cost_usd, 0) + greatest(p_amount, 0)
   where id = p_run_id;
$$;

-- Budget functions are server-only: callable by the service-role key,
-- never by a signed-in browser client through the REST API.
revoke execute on function reserve_discovery(uuid) from public, anon, authenticated;
revoke execute on function release_candidates(uuid, int) from public, anon, authenticated;
revoke execute on function reserve_scrape(uuid) from public, anon, authenticated;
revoke execute on function add_claude_cost(uuid, numeric) from public, anon, authenticated;
grant execute on function reserve_discovery(uuid) to service_role;
grant execute on function release_candidates(uuid, int) to service_role;
grant execute on function reserve_scrape(uuid) to service_role;
grant execute on function add_claude_cost(uuid, numeric) to service_role;

-- Row Level Security — design.md Section 2 & 11: shared workspace, every
-- authenticated user reads everything; only the service-role key (used by
-- the Inngest function and the two API routes in Section 1) writes to
-- leads/tool_calls at all. Client-side inserts are limited to `runs`, and
-- only as the row's own creator.

alter table runs enable row level security;
alter table leads enable row level security;
alter table tool_calls enable row level security;

create policy "authenticated users read all runs"
  on runs for select
  to authenticated
  using (true);

create policy "authenticated users create their own runs"
  on runs for insert
  to authenticated
  with check (created_by = auth.uid());

-- No update/delete policy on runs for the anon/authenticated role on
-- purpose — status transitions happen only via the service-role key
-- (Inngest function), never from the client.

create policy "authenticated users read all leads"
  on leads for select
  to authenticated
  using (true);

-- No insert/update/delete policy on leads for authenticated users — all
-- writes (agent-produced, human edits, regenerates) go through
-- service-role-authenticated server code (design.md Section 11).

create policy "authenticated users read all tool_calls"
  on tool_calls for select
  to authenticated
  using (true);

-- Reminder (not enforceable in SQL): disable public sign-up for this
-- Supabase project — Authentication > Settings > "Allow new users to sign
-- up" must be turned OFF, and new users provisioned via the dashboard's
-- invite flow. See artifact/design.md Section 11.
