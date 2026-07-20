-- Migration 0024 — per-run export document rail (factory uploads, hub tracks)
create table if not exists run_documents (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references production_runs(id),
  doc_type text not null,  -- commercial_invoice|packing_list|certificate_of_origin|vgm|ispm15|coa|other
  filename text not null,
  storage_path text not null,
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz not null default now()
);
alter table run_documents enable row level security;
create policy rd_internal on run_documents for all using (is_internal()) with check (is_internal());
create policy rd_factory on run_documents for all
  using (exists (select 1 from production_runs r where r.id = run_id and is_factory_member(r.factory_id)))
  with check (exists (select 1 from production_runs r where r.id = run_id and is_factory_member(r.factory_id)));
