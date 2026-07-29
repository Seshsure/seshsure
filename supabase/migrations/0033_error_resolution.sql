-- 0033: resolution tracking on error_log — the dashboard needs "seen and
-- handled" vs "still burning", and who closed it.
alter table error_log add column if not exists resolved_at timestamptz;
alter table error_log add column if not exists resolved_by uuid references profiles(id);
