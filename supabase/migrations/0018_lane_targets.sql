-- Migration 0018 — owner-set lane targets ("what it should be")
create table if not exists lane_targets (
  lane_key text primary key,               -- 'sea|Nhava Sheva→Denver'
  target_cents bigint not null,
  note text,
  set_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);
alter table lane_targets enable row level security;
create policy lt_internal on lane_targets for all using (is_internal()) with check (is_internal());
