-- ============================================================
-- Migration 0013 — Pipeline: prospects, samples, referral credits, win-back
-- ============================================================
create table prospects (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  contact_name text,
  email text,
  phone text,
  lead_source text not null,
  stage text not null default 'lead',
  show_capture boolean not null default false,
  show_name text,
  notes text,
  desired_cones jsonb,
  referred_by_client_id uuid references clients(id),
  converted_client_id uuid references clients(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sample_shipments (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references prospects(id),
  client_id uuid references clients(id),
  contents text not null default 'standard 20-cone pack',
  branded boolean not null default false,
  shipped_at timestamptz,
  address text,
  followup_3_done boolean not null default false,
  followup_10_done boolean not null default false,
  auto_email_sent boolean not null default false,
  created_at timestamptz not null default now()
);

create table referral_credits (
  id uuid primary key default gen_random_uuid(),
  referrer_client_id uuid not null references clients(id),
  referred_client_id uuid not null references clients(id),
  cones_ordered bigint not null default 0,
  credit_cents bigint not null default 0,
  granted_at timestamptz,
  first_order_settled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (referrer_client_id, referred_client_id)
);

alter table clients add column if not exists last_order_at timestamptz;
alter table clients add column if not exists expected_reorder_weeks int;
alter table clients add column if not exists dormant boolean not null default false;

alter table prospects enable row level security;
alter table sample_shipments enable row level security;
alter table referral_credits enable row level security;
create policy pros_internal on prospects for all using (is_internal()) with check (is_internal());
create policy ss_internal on sample_shipments for all using (is_internal()) with check (is_internal());
create policy rcr_owner on referral_credits for all using (is_owner()) with check (is_owner());
create policy rcr_client_view on referral_credits for select using (is_client_member(referrer_client_id));
