-- Resumable searches: see artifact/design.md Section 4. Run after
-- 0001_init.sql, once (SQL editor or CLI).
--
-- 1. `candidates` checkpoints what discovery found, so an automatic retry
--    or a user's "Continue search" picks up the companies that were found
--    (and paid for) but not yet checked, instead of losing them.
-- 2. Attempt tracking on `runs` lets a failed search continue as the same
--    search, and lets the UI time each attempt honestly.

create table if not exists candidates (
  id             uuid primary key default gen_random_uuid(),
  run_id         uuid not null references runs (id) on delete cascade,
  domain         text not null,
  name           text not null,
  data           jsonb not null,  -- the slim company record discovery returned
  discovered_at  timestamptz not null default now(),
  unique (run_id, domain)
);

create index if not exists candidates_run_id_idx on candidates (run_id);

alter table candidates enable row level security;

create policy "authenticated users read all candidates"
  on candidates for select
  to authenticated
  using (true);

-- No write policy: only the server (service-role key) writes candidates.

alter table runs
  add column if not exists attempt             int not null default 1 check (attempt >= 1),
  add column if not exists attempt_started_at  timestamptz not null default now(),
  -- Time spent in attempts that already ended, so a continued search's
  -- total excludes the gap while it sat failed.
  add column if not exists prior_attempts_ms   bigint not null default 0 check (prior_attempts_ms >= 0);

-- Existing rows: their only attempt started when the search was created.
update runs set attempt_started_at = created_at where attempt = 1;

-- Puts a failed search back in the queue as the same search: keeps its
-- leads, candidates, ICP and budget counters; starts a new attempt. Only
-- the person who started it, and only from 'failed'. Returns the new
-- attempt number, or null if it couldn't continue.
create or replace function continue_run(p_run_id uuid, p_user_id uuid)
returns int
language plpgsql
set search_path = public
as $$
declare
  v_attempt int;
begin
  update runs
     set prior_attempts_ms = prior_attempts_ms
           + greatest(0, floor(extract(epoch from (coalesce(completed_at, now()) - attempt_started_at)) * 1000))::bigint,
         attempt = attempt + 1,
         attempt_started_at = now(),
         status = 'pending',
         status_note = null,
         current_stage = null,
         completed_at = null
   where id = p_run_id
     and created_by = p_user_id
     and status = 'failed'
  returning attempt into v_attempt;

  return v_attempt;
end;
$$;

revoke execute on function continue_run(uuid, uuid) from public, anon, authenticated;
grant execute on function continue_run(uuid, uuid) to service_role;
