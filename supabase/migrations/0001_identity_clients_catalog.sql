-- ============================================================
-- SeshSure Hub — Migration 0001
-- Identity, roles, clients, onboarding, catalog & pricing
-- Money stored as integer cents ("_cents") or micro-cents per
-- cone ("_microcents": 1/10,000 of a cent) — never floats.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Enums ----------
create type user_role as enum ('owner','staff','client_admin','client_ap','factory_admin','factory_user');
create type client_status as enum ('prospect','invited','onboarding','review','active','held','former');
create type prospect_stage as enum ('lead','paperwork','sample','onboarding','client','lost');
create type invoice_status as enum ('draft','sent','viewed','partially_paid','paid','overdue','in_collections','void');
create type invoice_kind as enum ('deposit','balance','full','interest','manual','credit_memo');
create type payment_method as enum ('ach','wire','check','cash','credit_applied');
create type payment_status as enum ('authorized','scheduled','submitted','settled','cleared','returned','failed');
create type order_status as enum ('draft','submitted','quoted','approved','in_production','shipped','delivered','cancelled','expired');
create type proof_status as enum ('pending','sent','approved','revision_requested');
create type run_status as enum ('placed','confirmed','in_production','qc_pending','qc_approved','shipped','landed','closed');
create type claim_status as enum ('filed','under_review','auto_credited','resolved_replacement','resolved_credit','denied');
create type case_status as enum ('pre_filing','filed','served','judgment','settled','satisfied','dismissed','closed');
create type freight_mode as enum ('sea','air','client_arranged','domestic_parcel');

-- ---------- Profiles (all humans, keyed to auth.users) ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null,
  full_name text not null,
  email text not null,
  phone text,
  client_id uuid,          -- set for client_* roles
  factory_id uuid,         -- set for factory_* roles
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Entities (issuer; multi-entity ready) ----------
create table entities (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,          -- Vido Manufacturing and Distribution Corp
  dba text,                          -- SeshSure
  ein text,
  remit_address text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Clients ----------
create table clients (
  id uuid primary key default gen_random_uuid(),
  status client_status not null default 'prospect',
  prospect_stage prospect_stage default 'lead',
  lead_source text,                          -- required by app on prospects
  referred_by_client_id uuid references clients(id),
  legal_name text,
  dba text,
  entity_type text,
  formation_state text,
  ein text,
  phone text,
  website text,
  is_taxable boolean not null default true,  -- flips false w/ valid resale cert
  tax_rate_bps int not null default 0,       -- per primary ship-to, basis points
  deposit_pct int not null default 50,       -- 0 allowed (deposit optional per order)
  credit_ceiling_cents bigint,               -- everyone gets one at activation
  net_terms_days int,                        -- null = due on delivery
  auto_hold boolean not null default true,   -- +21 auto-hold (per-client override)
  hold_active boolean not null default false,
  health_grade text,                         -- computed A..F
  ap_ingest_email text,                      -- their Bill.com/QBO ingest address
  notes_pinned text,
  activated_at timestamptz,
  created_at timestamptz not null default now()
);
alter table profiles add constraint profiles_client_fk foreign key (client_id) references clients(id);

create table client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  role text not null,                        -- purchasing | ap | owner
  name text, email text, phone text
);

create table client_addresses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  label text,
  address text not null,
  receiving_notes text,
  tax_rate_bps int,
  is_third_party boolean not null default false
);

create table client_licenses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  license_number text,
  state text,
  license_type text,
  expires_on date,
  document_path text
  -- informational only; never gates anything
);

create table client_brands (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- ---------- Onboarding ----------
create table onboarding_progress (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  step text not null,               -- profile|contacts|shipping|agreements|banking|tax|credit_app
  completed_at timestamptz,
  unique (client_id, step)
);

create table agreement_versions (
  id uuid primary key default gen_random_uuid(),
  doc_key text not null,            -- master_sales|ach_auth|credit_pg|factory_terms|hub_tou|privacy
  version int not null,
  body_md text not null,
  effective_at timestamptz not null default now(),
  unique (doc_key, version)
);

create table signatures (          -- append-only (no update/delete policies)
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id),
  factory_id uuid,
  agreement_version_id uuid not null references agreement_versions(id),
  signer_profile_id uuid references profiles(id),
  signer_name_typed text not null,
  signer_title text,
  ip inet,
  user_agent text,
  signed_at timestamptz not null default now()
);

create table client_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  kind text not null,               -- resale_cert|voided_check|w9|coi|other|signed_agreement
  storage_path text not null,
  expires_on date,
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz not null default now()
);

create table client_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  bank_name text,
  routing_number_enc text not null,     -- vault-encrypted
  account_number_enc text not null,     -- vault-encrypted
  account_last4 text not null,
  account_type text not null default 'business_checking',
  name_on_account text,
  check_doc_path text,
  micro_amount_1 int,                    -- cents, secret until verified
  micro_amount_2 int,
  micro_attempts int not null default 0,
  check_verified boolean not null default false,
  micro_verified boolean not null default false,
  is_active boolean not null default true,   -- one active per client (partial unique below)
  created_at timestamptz not null default now()
);
create unique index one_active_bank_per_client on client_bank_accounts(client_id) where is_active;

-- ---------- Catalog & pricing ----------
create table products (
  id uuid primary key default gen_random_uuid(),
  family text not null,             -- cone | tube
  sku text not null unique,
  description text not null,
  branded boolean not null,
  paper_group text not null,        -- bleached_unbleached_hemp | colored
  paper_type text,
  filter_style text not null,       -- blank|spiral|custom|sticker|holo_sticker|flavour_beads|glass
  filter_type text not null,        -- mw|spiral|glass
  size_mm int,
  pack_format text,
  cones_per_carton int,
  carton_weight_g int,
  carton_l_mm int, carton_w_mm int, carton_h_mm int,
  is_flagship boolean not null default false,   -- SeshSure social cone (15¢ margin floor)
  is_listed boolean not null default true,
  created_at timestamptz not null default now()
);

-- Factory cost rate card (per-cone microcents; monthly-volume tiers) — OWNER ONLY via RLS
create table factory_rate_card (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  monthly_volume_min bigint not null default 0,   -- tier keyed to client monthly volume
  cost_per_cone_microcents bigint not null,
  effective_at timestamptz not null default now(),
  acknowledged_by_factory_at timestamptz
);

-- Default sell tiers (monthly-volume keyed)
create table price_tiers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  monthly_volume_min bigint not null default 0,
  price_per_cone_microcents bigint not null,
  effective_at timestamptz not null default now()
);

create table client_price_overrides (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  product_id uuid not null references products(id),
  price_per_cone_microcents bigint not null,
  effective_at timestamptz not null default now(),
  unique (client_id, product_id, effective_at)
);

-- Freight lane rates (per-cone adders + lane table for estimates)
create table freight_lane_rates (
  id uuid primary key default gen_random_uuid(),
  mode freight_mode not null,
  per_cone_adder_microcents bigint,       -- air ≈ 15000 (1.5¢), sea ≈ 7500 (0.75¢)
  notes text,
  effective_at timestamptz not null default now()
);

-- Versioned spec sheets; runs pin to a version
create table product_specs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  version int not null,
  spec_md text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (product_id, version)
);
