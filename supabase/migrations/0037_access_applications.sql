-- 0037: verified-only public signup. The public can APPLY; only owner
-- approval creates access. Applications are written by the API (service
-- role) and readable internally only — no public RLS surface at all.
-- ref_code carries campaign attribution (QR at a booth, a DM link).
create table access_applications (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  contact_name text not null,
  email text not null,
  phone text,
  website text,
  state text,
  license_no text,                      -- cannabis license / resale cert if offered
  message text,
  ref_code text,                        -- /apply?ref=MJBIZCON26 → attribution
  status text not null default 'pending' check (status in ('pending','approved','denied')),
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index access_apps_status on access_applications(status, created_at desc);
create unique index access_apps_one_pending on access_applications(lower(email)) where status = 'pending';

alter table access_applications enable row level security;
create policy apps_internal on access_applications for all
  using (is_internal()) with check (is_internal());
