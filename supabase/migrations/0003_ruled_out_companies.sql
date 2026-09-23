-- Keeps companies that discovery ruled out before checking (no usable
-- website, size or HQ country outside the request), with the reason, so
-- a search's "All companies" view can list every company it paid for.
-- Run after 0002_resume.sql, once.
--
-- A NULL reason means the company passed the checks and is (or was)
-- waiting to be checked. `domain` holds a stable key; companies with no
-- website use their LinkedIn URL (or name) instead, see lib/discovery.ts.

alter table candidates add column if not exists ruled_out_reason text;
