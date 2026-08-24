-- 0045: EVIDENCE — photos from the supply chain + the vault that makes
-- all evidence survive deletion.
-- evidence_photos: one generic rail for POD (forwarder), QC (factory),
-- and any future photo evidence. Ownership columns denormalized at insert
-- for simple per-role RLS. Insert via API only (membership validated
-- server-side); reads: internal sees all, orgs see their own.
create table evidence_photos (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('pod','qc','damage','other')),
  entity_table text not null check (entity_table in ('shipments','production_runs')),
  entity_id uuid not null,
  storage_path text not null,
  caption text,
  uploaded_by uuid not null references profiles(id),
  factory_id uuid references factories(id),
  forwarder_id uuid references forwarders(id),
  created_at timestamptz not null default now()
);
create index ev_entity on evidence_photos(entity_table, entity_id);
alter table evidence_photos enable row level security;
create policy ev_internal on evidence_photos for all using (is_internal());
create policy ev_factory_read on evidence_photos for select
  using (factory_id is not null and is_factory_member(factory_id));
create policy ev_forwarder_read on evidence_photos for select
  using (forwarder_id is not null and exists (
    select 1 from profiles p where p.id = auth.uid() and p.forwarder_id = evidence_photos.forwarder_id));

-- backup_log: the vault's memory — what's mirrored, when, from where.
create table backup_log (
  id bigint generated always as identity primary key,
  bucket text not null,
  object_path text not null,
  vault_path text not null,
  bytes bigint,
  backed_up_at timestamptz not null default now(),
  unique (bucket, object_path)
);
alter table backup_log enable row level security;
create policy bl_internal on backup_log for all using (is_internal());
