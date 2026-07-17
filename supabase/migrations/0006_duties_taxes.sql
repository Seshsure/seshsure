-- ============================================================
-- SeshSure Hub — Migration 0006
-- Duties & import taxes in landed cost
-- Duty = declared entry value × applicable rate stack (per HTS
-- + trade programs), plus MPF/HMF. Declared value captured per
-- shipment from the commercial invoice; rates configurable.
-- ============================================================

-- Declared customs value per shipment (from commercial invoice)
alter table shipments add column declared_value_cents bigint;
alter table shipments add column duty_basis_note text;  -- e.g. 'per CI #...' / 'first-sale documented'

-- Configurable duty rate stack (MFN + 301 + IEEPA/reciprocal etc.)
create table duty_programs (
  id uuid primary key default gen_random_uuid(),
  hts_code text not null default '4813.10.0000',
  program text not null,                -- 'MFN' | 'SEC301' | 'IEEPA' | ...
  rate_bps int not null,                -- basis points on declared value
  country_of_origin text,
  effective_from date,
  effective_to date,
  notes text
);
create policy dp_internal on duty_programs for select using (is_internal());
create policy dp_owner on duty_programs for all using (is_owner()) with check (is_owner());
alter table duty_programs enable row level security;

-- Entry fees (US): Merchandise Processing Fee + Harbor Maintenance Fee
create table entry_fee_config (
  key text primary key,                 -- 'mpf_rate_bps','mpf_min_cents','mpf_max_cents','hmf_rate_bps'
  value_numeric numeric not null,
  updated_at timestamptz not null default now()
);
insert into entry_fee_config values
  ('mpf_rate_bps', 34.64, now()),       -- 0.3464% of entered value
  ('mpf_min_cents', 3308, now()),       -- floor/ceiling adjust annually — config, not code
  ('mpf_max_cents', 64230, now()),
  ('hmf_rate_bps', 12.5, now());        -- 0.125%, sea entries only
alter table entry_fee_config enable row level security;
create policy efc_internal on entry_fee_config for select using (is_internal());
create policy efc_owner on entry_fee_config for all using (is_owner()) with check (is_owner());

-- Landed-cost view feeds: duties + fees land in shipment_costs
-- (duties_cents, fees_cents already exist) and roll into ¢/cone.
comment on column shipments.declared_value_cents is
  'Entered value from commercial invoice. Duty & MPF/HMF compute on this. Must equal actual transaction value per 19 USC 1401a unless a documented first-sale structure applies.';
