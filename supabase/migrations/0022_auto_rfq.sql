-- Migration 0022 — auto-RFQ chain: paid order + factory pickup date → shipment sheet
alter table production_runs add column if not exists pickup_ready_date date;
alter table production_runs add column if not exists run_orders_rfq_id uuid references freight_rfqs(id);
alter table freight_rfqs add column if not exists auto_created boolean not null default false;
