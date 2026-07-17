-- ============================================================
-- Migration 0015 — Storage: client artwork + dispute media (photo/video)
-- Buckets are private; access flows through RLS on storage.objects.
-- Path convention: {bucket}/{client_id}/{filename} — the folder IS the wall.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('art', 'art', false, 52428800,
   array['image/png','image/jpeg','image/svg+xml','application/pdf','application/postscript']),
  ('dispute-media', 'dispute-media', false, 104857600,
   array['image/png','image/jpeg','image/heic','video/mp4','video/quicktime'])
on conflict (id) do nothing;

-- clients upload/read within their own folder only
create policy art_client_rw on storage.objects for all
  using (bucket_id = 'art' and is_client_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'art' and is_client_member(((storage.foldername(name))[1])::uuid));

create policy art_internal on storage.objects for all
  using (bucket_id = 'art' and is_internal())
  with check (bucket_id = 'art' and is_internal());

create policy dm_store_client_rw on storage.objects for all
  using (bucket_id = 'dispute-media' and is_client_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'dispute-media' and is_client_member(((storage.foldername(name))[1])::uuid));

create policy dm_store_internal on storage.objects for all
  using (bucket_id = 'dispute-media' and is_internal())
  with check (bucket_id = 'dispute-media' and is_internal());

-- factories may VIEW dispute media for their runs (the claim evidence), never client art
create policy dm_store_factory_read on storage.objects for select
  using (bucket_id = 'dispute-media' and exists (
    select 1 from disputes d
    join production_runs r on r.id = d.run_id
    join dispute_media m on m.dispute_id = d.id
    where m.path = storage.objects.name and is_factory_member(r.factory_id)));

-- art_assets gains mockup + print-readiness metadata
alter table art_assets add column if not exists storage_path text;
alter table art_assets add column if not exists file_type text;
alter table art_assets add column if not exists width_px int;
alter table art_assets add column if not exists height_px int;
alter table art_assets add column if not exists dpi_estimate int;
alter table art_assets add column if not exists print_ready boolean;
alter table art_assets add column if not exists print_notes text;

alter table dispute_media add column if not exists media_kind text not null default 'photo'; -- photo | video
alter table dispute_media add column if not exists size_bytes bigint;

alter table orders add column if not exists art_asset_id uuid references art_assets(id);
