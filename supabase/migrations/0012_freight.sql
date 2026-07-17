-- ============================================================
-- Migration 0012 — Freight: the Desk, bids, milestones, exceptions
-- ============================================================

create table forwarders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text,
  modes text[] not null default '{sea,air}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table freight_rfqs (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid references shipments(id),
  run_id uuid references production_runs(id),
  mode text not null default 'sea',
  cargo_summary jsonb not null,
  status text not null default 'open',
  bid_deadline timestamptz,
  awarded_forwarder_id uuid references forwarders(id),
  awarded_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table freight_bids (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references freight_rfqs(id) on delete cascade,
  forwarder_id uuid not null references forwarders(id),
  all_in_cents bigint not null,
  transit_days int,
  valid_until date,
  notes text,
  created_at timestamptz not null default now(),
  unique (rfq_id, forwarder_id)
);

create table shipment_milestones (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references shipments(id) on delete cascade,
  code text not null,
  description text,
  occurred_at timestamptz not null,
  source text not null default 'easypost',
  raw jsonb,
  created_at timestamptz not null default now()
);
create index on shipment_milestones (shipment_id, occurred_at);

alter table shipments add column if not exists free_days int;
alter table shipments add column if not exists arrived_port_at timestamptz;
alter table shipments add column if not exists last_scan_at timestamptz;
alter table shipments add column if not exists eta date;
alter table shipments add column if not exists easypost_tracker_id text;
alter table shipments add column if not exists awarded_freight_cents bigint;

alter table forwarders enable row level security;
alter table freight_rfqs enable row level security;
alter table freight_bids enable row level security;
alter table shipment_milestones enable row level security;

create policy fw_owner on forwarders for all using (is_internal()) with check (is_internal());
create policy rfq_owner on freight_rfqs for all using (is_internal()) with check (is_internal());
create policy fb_owner on freight_bids for all using (is_internal()) with check (is_internal());
create policy sm_owner on shipment_milestones for all using (is_internal()) with check (is_internal());

-- CLIENT VISIBILITY RULE (locked): US port/customs onward ONLY
create policy sm_client on shipment_milestones for select using (
  code in ('arrived_us_port','customs_cleared','out_for_delivery','delivered')
  and exists (
    select 1 from shipments s join orders o on o.id = s.order_id
    where s.id = shipment_id and is_client_member(o.client_id)));
