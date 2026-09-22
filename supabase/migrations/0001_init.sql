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
                      check (status in ('pending', 'running', 'completed', 'failed')),
  status_note       text,
  current_stage     text, -- plain-language pipeline stage for the UI trail;
                          -- not in design.md's original schema — added because
                          -- frontend-design.md's trail needs *something* to
                          -- render against beyond the 4-value `status` enum
  created_by        uuid not null references auth.users (id),
  created_by_email  text not null,
  claude_cost_usd   numeric,
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
