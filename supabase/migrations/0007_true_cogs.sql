-- ============================================================
-- SeshSure Hub — Migration 0007
-- TRUE COGS: customs value and economic cost are separate truths.
-- Factory invoices split goods vs services; services allocate
-- back into per-cone COGS even though excluded from customs value.
-- ============================================================

-- Every factory invoice is typed
alter table factory_invoices add column kind text not null default 'goods';
alter table factory_invoices add constraint fi_kind check (kind in ('goods','services','freight','other'));

-- Services allocation: spread a services invoice across runs (per-cone truth)
create table cost_allocations (
  id uuid primary key default gen_random_uuid(),
  factory_invoice_id uuid not null references factory_invoices(id) on delete cascade,
  run_id uuid not null references production_runs(id),
  amount_cents bigint not null,
  method text not null default 'per_cone',   -- per_cone | manual | per_run
  created_at timestamptz not null default now()
);
alter table cost_allocations enable row level security;
create policy calo_owner on cost_allocations for all using (is_owner()) with check (is_owner());
create policy calo_staff on cost_allocations for select using (is_internal());

-- Shipment cost line for allocated services (joins goods/freight/duties/fees)
alter table shipment_costs add column services_cents bigint default 0;

-- TRUE COGS per run, per cone — the margin engine reads THIS, never the customs value
create or replace view run_true_cogs as
select
  r.id as run_id,
  sum(distinct coalesce(sc.goods_cents,0))    as goods_cents,
  coalesce(sum(ca.amount_cents),0)            as services_cents,
  sum(distinct coalesce(sc.freight_actual_cents, sc.freight_quoted_cents, 0)) as freight_cents,
  sum(distinct coalesce(sc.duties_cents,0))   as duties_cents,
  sum(distinct coalesce(sc.fees_cents,0))     as fees_cents,
  (select coalesce(sum(l.quantity),0) from lots l where l.run_id = r.id) as cones
from production_runs r
left join shipments s on s.run_id = r.id
left join shipment_costs sc on sc.shipment_id = s.id
left join cost_allocations ca on ca.run_id = r.id
group by r.id;

comment on view run_true_cogs is
  'Economic COGS per run: goods + allocated services + freight + duties + fees. Per-cone = total/cones. Customs declared value lives on shipments and is NEVER used for margin.';
