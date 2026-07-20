-- Migration 0017 — freight cost intelligence
alter table freight_rfqs add column if not exists units_count bigint;   -- cones aboard → $/1,000 cones
create table if not exists packing_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  carton_l_cm numeric not null, carton_w_cm numeric not null, carton_h_cm numeric not null,
  units_per_carton int not null,
  carton_kg numeric,
  created_at timestamptz not null default now()
);
alter table packing_presets enable row level security;
create policy pp_internal on packing_presets for all using (is_internal()) with check (is_internal());
