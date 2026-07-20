-- ============================================================
-- Migration 0021 — Complete factory onboarding: identity, banking,
-- documents vault, capabilities. The factory tells us who they are;
-- nothing is assumed on our side.
-- ============================================================

alter table factories add column if not exists legal_name text;
alter table factories add column if not exists address_line1 text;
alter table factories add column if not exists address_line2 text;
alter table factories add column if not exists city text;
alter table factories add column if not exists region text;
alter table factories add column if not exists postal_code text;
alter table factories add column if not exists registration_no text;   -- company/CIN
alter table factories add column if not exists tax_id text;            -- GSTIN / VAT
alter table factories add column if not exists pan_no text;
alter table factories add column if not exists iec_code text;          -- import-export code
alter table factories add column if not exists contact_name text;
alter table factories add column if not exists contact_phone text;
alter table factories add column if not exists contact_whatsapp text;
alter table factories add column if not exists monthly_capacity_units bigint;
alter table factories add column if not exists moq_units bigint;
alter table factories add column if not exists lead_time_days int;
alter table factories add column if not exists onboarding_complete boolean not null default false;

create table if not exists factory_documents (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null references factories(id),
  doc_type text not null,   -- registration|tax_cert|iec|bank_letter|quality_cert|food_contact|other
  filename text not null,
  storage_path text not null,
  note text,
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz not null default now()
);
alter table factory_documents enable row level security;
create policy fd_internal on factory_documents for all using (is_internal()) with check (is_internal());
create policy fd_factory_rw on factory_documents for all
  using (factory_id = (select factory_id from profiles where id = auth.uid()))
  with check (factory_id = (select factory_id from profiles where id = auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('factory-docs', 'factory-docs', false, 26214400,
  array['image/png','image/jpeg','application/pdf'])
on conflict (id) do nothing;

create policy fdocs_factory_rw on storage.objects for all
  using (bucket_id = 'factory-docs' and ((storage.foldername(name))[1])::uuid = (select factory_id from profiles where id = auth.uid()))
  with check (bucket_id = 'factory-docs' and ((storage.foldername(name))[1])::uuid = (select factory_id from profiles where id = auth.uid()));
create policy fdocs_internal on storage.objects for all
  using (bucket_id = 'factory-docs' and is_internal())
  with check (bucket_id = 'factory-docs' and is_internal());
-- addendum: factories read published specs
create policy ps_read_factory on product_specs for select using (exists (select 1 from profiles where id = auth.uid() and factory_id is not null));
