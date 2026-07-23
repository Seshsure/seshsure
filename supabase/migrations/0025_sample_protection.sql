-- Migration 0025 — flagship sample protection: standalone e-sign links + gate
alter table signatures add column if not exists signer_email text;
alter table signatures add column if not exists signer_company text;

create table if not exists esign_links (
  id uuid primary key default gen_random_uuid(),
  doc_key text not null,                       -- e.g. 'sample_eval'
  client_id uuid references clients(id),       -- nullable: prospects sign before they're clients
  recipient_email text not null,
  recipient_company text,
  token text not null unique default encode(gen_random_bytes(24),'hex'),
  expires_at timestamptz not null default now() + interval '30 days',
  signed_at timestamptz,
  signature_id uuid references signatures(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table esign_links enable row level security;
create policy el_internal on esign_links for all using (is_internal()) with check (is_internal());
