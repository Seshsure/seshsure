-- Migration 0014 — Demand letters: the +30 collections step, drafted by machine, sent by Rob
create table demand_letters (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  invoice_ids uuid[] not null,
  total_demanded_cents bigint not null,
  draft_text text not null,
  status text not null default 'draft',       -- draft | approved_sent | withdrawn
  approved_by uuid references profiles(id),
  sent_at timestamptz,
  sent_via text,                              -- email | certified_mail | both
  created_at timestamptz not null default now()
);
alter table demand_letters enable row level security;
create policy dl_owner on demand_letters for all using (is_owner()) with check (is_owner());
