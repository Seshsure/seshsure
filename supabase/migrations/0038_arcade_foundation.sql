-- 0038: WHITE-LABEL ARCADE — foundation layer: access control + audit.
-- The program's first rule is that it doesn't exist for a client until the
-- owner approves them individually, so access is the root object. The
-- compliance gate lives HERE, at approval time: the counsel-reviewed
-- sweepstakes rules document attaches to the client's arcade access, never
-- becoming a launch blocker later. Revocation suspends new orders and new
-- hunts; live hunts run to their published end dates (enforced app-side).

create type arcade_access_status as enum
  ('not_applied','applied','approved','denied','suspended');

create table arcade_access (
  client_id uuid primary key references clients(id) on delete cascade,
  status arcade_access_status not null default 'applied',
  applied_at timestamptz not null default now(),
  applied_by uuid references profiles(id),
  application_note text,                        -- why they want in
  rules_doc_path text,                          -- counsel-reviewed sweepstakes rules (storage path)
  rules_doc_attached_at timestamptz,
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  decision_note text,
  arcade_slug text unique,                      -- arcade.seshsure.com/{slug} — set at approval
  suspended_at timestamptz
);

-- Every access transition is auditable forever: who, when, from → to.
create table arcade_access_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  from_status text,
  to_status text not null,
  actor uuid references profiles(id),
  note text,
  created_at timestamptz not null default now()
);

alter table arcade_access enable row level security;
alter table arcade_access_log enable row level security;

-- Internal: everything. Client: sees own access row (to render Locked /
-- Applied / Approved states) but can never write it — applying goes
-- through the API so the transition is validated and logged.
create policy arc_access_internal on arcade_access for all
  using (is_internal()) with check (is_internal());
create policy arc_access_client_read on arcade_access for select
  using (client_id = (select client_id from profiles where id = auth.uid()));
create policy arc_log_internal on arcade_access_log for all
  using (is_internal()) with check (is_internal());
