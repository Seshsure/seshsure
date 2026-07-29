-- 0032: in-house error monitoring. No third-party APM vendor: errors land
-- here (internal-only RLS), alerts ride the existing verified email rail to
-- the owner, throttled by signature so a crash-loop sends one email, not
-- four hundred. Zero new endpoints — server-side reporting only, so this
-- adds no public attack surface.
create table error_log (
  id uuid primary key default gen_random_uuid(),
  source text not null,              -- e.g. 'cron.reminderLadder', 'api.factory.ship'
  signature text not null,           -- source + message hash → throttle key
  message text not null,
  detail text,                       -- truncated stack, never env contents
  created_at timestamptz not null default now(),
  alerted_at timestamptz             -- set when an owner email fired for this signature window
);
create index error_log_sig_time on error_log (signature, created_at desc);

alter table error_log enable row level security;
create policy err_internal on error_log for all using (is_internal()) with check (is_internal());
