-- Optional ICP review: a search can stop after Hound saves its ICP, wait
-- for the person who started it to check or edit it, then search with
-- the approved version. Run after 0003_ruled_out_companies.sql, once.
--
-- Existing searches are untouched: review_icp defaults to false, so they
-- never wait, and review_wait_ms defaults to 0, so their times don't
-- change.

alter table runs drop constraint if exists runs_status_check;
alter table runs add constraint runs_status_check
  check (status in ('pending', 'running', 'awaiting_review', 'completed', 'failed', 'declined'));

alter table runs
  -- Chosen on the search form. Off by default: searches stay automatic.
  add column if not exists review_icp        boolean not null default false,
  -- When this attempt stopped to wait. The 24-hour expiry checks it, so
  -- it only ever expires the wait it was scheduled for.
  add column if not exists review_started_at timestamptz,
  -- Set once the owner approves. From then on the ICP is final: save_icp
  -- refuses, and the search goes straight to finding companies.
  add column if not exists icp_approved_at   timestamptz,
  -- Time spent waiting in this attempt, left out of the search's time so
  -- it shows Hound's working time only.
  add column if not exists review_wait_ms    bigint not null default 0 check (review_wait_ms >= 0);

-- Approves a waiting search's ICP, with the owner's edits (p_icp) or as
-- Hound wrote it (null), and puts it back in the queue. Only the person
-- who started it, only while it's waiting, and only before discovery.
-- Returns true if it was approved.
create or replace function approve_icp(p_run_id uuid, p_user_id uuid, p_icp jsonb)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  update runs
     set refined_icp = coalesce(p_icp, refined_icp),
         icp_approved_at = now(),
         review_wait_ms = review_wait_ms
           + greatest(0, floor(extract(epoch from (now() - review_started_at)) * 1000))::bigint,
         status = 'pending',
         status_note = null
   where id = p_run_id
     and created_by = p_user_id
     and status = 'awaiting_review'
     and discovery_passes_used = 0
  returning id into v_id;

  return v_id is not null;
end;
$$;

revoke execute on function approve_icp(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function approve_icp(uuid, uuid, jsonb) to service_role;

-- Same as 0002's continue_run, except that the time an attempt spent
-- waiting for review isn't counted as working time, and the new attempt
-- starts with no wait of its own.
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
           + greatest(0, floor(extract(epoch from (coalesce(completed_at, now()) - attempt_started_at)) * 1000)::bigint
                         - review_wait_ms),
         review_wait_ms = 0,
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
