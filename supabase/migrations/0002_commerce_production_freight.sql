-- ============================================================
-- SeshSure Hub — Migration 0002
-- Orders & proofs, invoices & payments (ACH), production runs,
-- freight desk, claims, factory AP
-- ============================================================

-- ---------- Quotes ----------
create table quotes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id),          -- nullable: prospect quotes allowed
  prospect_note text,
  status text not null default 'open',            -- open|accepted|expired|withdrawn
  expires_at timestamptz not null,                -- default now()+7d set by app
  total_cents bigint,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  product_id uuid references products(id),
  description text,
  quantity bigint not null,
  price_per_cone_microcents bigint not null
);

-- ---------- Orders ----------
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique,                       -- SS-O-xxxx assigned at approval
  client_id uuid not null references clients(id),
  brand_id uuid references client_brands(id),
  quote_id uuid references quotes(id),
  status order_status not null default 'submitted',
  po_number text not null,
  need_by date,
  special_instructions text,
  ship_to_address_id uuid references client_addresses(id),
  freight_mode freight_mode,
  seshsure_arranged_freight boolean not null default false,
  freight_line_cents bigint default 0,
  deposit_pct int,                                -- null → client default; 0 = no deposit
  rush_note text,
  delivery_estimate date,                         -- Rob sets at confirmation
  is_sample boolean not null default false,
  is_replacement boolean not null default false,
  replacement_for_claim uuid,
  auto_approved boolean not null default false,   -- clean-repeat path
  early_start_override boolean not null default false,
  expires_at timestamptz,                         -- unpaid deposit: +14d
  revision int not null default 1,
  approved_at timestamptz,
  approved_by uuid references profiles(id),
  cancelled_reason text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  spec_version_id uuid references product_specs(id),
  quantity bigint not null,
  price_per_cone_microcents bigint not null
);

create table order_revisions (                    -- append-only change history
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  revision int not null,
  snapshot jsonb not null,
  changed_by uuid references profiles(id),
  changed_at timestamptz not null default now()
);

-- ---------- Art & proofs ----------
create table art_assets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id),
  brand_id uuid references client_brands(id),
  storage_path text not null,
  original_filename text,
  validation_report jsonb,                        -- art-AI findings
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz not null default now()
);

create table proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  version int not null,
  status proof_status not null default 'pending',
  source text not null default 'template',        -- template | factory_prepress
  storage_path text,
  pantones text[],
  approved_by_name text,                          -- tokenized-link approvals (prospects)
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  approval_ip inet,
  created_at timestamptz not null default now(),
  unique (order_id, version)
);

-- ---------- Invoices ----------
create table invoice_counters ( key text primary key, next_number bigint not null );
insert into invoice_counters values ('invoice', 1001), ('order', 1001), ('credit_memo', 1);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique,                     -- SS-1001+ assigned AT SEND (drafts null)
  legacy_number text,                             -- QB import keeps original numbers
  entity_id uuid references entities(id),
  client_id uuid not null references clients(id),
  order_id uuid references orders(id),
  kind invoice_kind not null,
  status invoice_status not null default 'draft',
  subtotal_cents bigint not null default 0,
  freight_cents bigint not null default 0,
  tax_cents bigint not null default 0,
  interest_cents bigint not null default 0,
  total_cents bigint not null default 0,
  paid_cents bigint not null default 0,
  currency text not null default 'USD',           -- always USD-denominated (CAD courtesy display)
  cad_courtesy_rate numeric,
  terms text,                                     -- 'due_on_delivery' | 'net_15' | ...
  due_date date,                                  -- balance: stamped at POD
  delivery_stamped_at timestamptz,
  sent_at timestamptz,
  first_viewed_at timestamptz,
  void_reason text,
  reissued_as uuid references invoices(id),
  dispute_flag boolean not null default false,
  dispute_paused boolean not null default false,  -- Rob's manual pause
  promise_to_pay_date date,
  created_at timestamptz not null default now()
);

create table invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  product_id uuid references products(id),
  description text not null,
  quantity bigint,
  unit_price_per_1000_cents bigint,               -- displayed per-1,000
  amount_cents bigint not null
);

create table invoice_views (                      -- append-only; notify Rob each view
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  viewer_profile_id uuid references profiles(id),
  ip inet,
  viewed_at timestamptz not null default now()
);

-- ---------- Payments & ACH ----------
create table payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  method payment_method not null,
  status payment_status not null,
  amount_cents bigint not null,
  scheduled_for date,                             -- ≤ due date only
  bank_account_id uuid references client_bank_accounts(id),
  batch_id uuid,
  settled_at timestamptz,
  cleared_at timestamptz,                         -- settled + 2 business days, no return
  return_code text,
  return_fee_cents bigint default 0,
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete cascade,
  invoice_id uuid not null references invoices(id),
  amount_cents bigint not null
);

create table ach_authorizations (                 -- APPEND-ONLY EVIDENCE
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id),
  client_id uuid not null references clients(id),
  amount_cents bigint not null,
  invoice_numbers text[],
  auth_text_version_id uuid references agreement_versions(id),
  authorized_by uuid references profiles(id),
  authorized_name text not null,
  ip inet, user_agent text,
  authorized_at timestamptz not null default now()
);

create table ach_batches (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'building',        -- building|approved|submitted|reconciled
  nacha_file_path text,
  total_cents bigint not null default 0,
  entry_count int not null default 0,
  includes_micro_deposits boolean not null default false,
  approved_by uuid references profiles(id),
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);
alter table payments add constraint payments_batch_fk foreign key (batch_id) references ach_batches(id);

create table account_credits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  amount_cents bigint not null,                   -- +credit / -applied / -refunded
  reason text not null,                           -- overpayment|referral|claim_credit|refund|manual
  reference_id uuid,
  created_at timestamptz not null default now()
);

-- ---------- Factories & runs ----------
create table factories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text,
  wire_details_enc text,                          -- vault; changes freeze payments pending voice-confirm
  wire_change_pending boolean not null default false,
  net_terms_days int,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table profiles add constraint profiles_factory_fk foreign key (factory_id) references factories(id);

create table production_runs (
  id uuid primary key default gen_random_uuid(),
  run_number text unique,                         -- R-xxxx
  factory_id uuid not null references factories(id),
  status run_status not null default 'placed',
  promise_date date,
  promise_revision_pending date,                  -- needs Rob acknowledgment
  spec_ack_file_version text,                     -- factory confirms producing file version
  rate_card_cost_cents bigint,                    -- auto-costed at placement
  placed_at timestamptz not null default now(),
  confirmed_at timestamptz,
  qc_photos_path text[],
  qc_ai_report jsonb,
  qc_approved_at timestamptz,                     -- Rob's photo gate
  shipped_at timestamptz
);

create table run_orders (                          -- many-to-many (consolidation-ready)
  run_id uuid not null references production_runs(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  primary key (run_id, order_id)
);

create table lots (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references production_runs(id),
  lot_number text not null,                       -- factory lot numbers, as-is
  quantity bigint,
  coa_path text,
  qr_token text unique default encode(gen_random_bytes(12),'hex'),
  material_batches jsonb                          -- upstream traceability (internal only)
);

-- ---------- Freight desk ----------
create table shipments (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references production_runs(id),
  order_id uuid references orders(id),
  mode freight_mode not null,
  incoterm text,
  carrier text,
  intl_tracking text,                             -- internal only
  domestic_tracking text,                         -- client-visible leg
  easypost_tracker_id text,
  milestones jsonb not null default '[]',         -- auto-pulled events
  eta date,
  buffer_days int not null default 0,
  free_days_at_port int,
  demurrage_deadline date,
  pod_path text,
  delivered_at timestamptz,                       -- auto-stamp → due date
  delivered_override_by uuid references profiles(id),
  readiness_checklist jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table shipment_costs (                     -- goods/freight/duties split — OWNER ONLY
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references shipments(id) on delete cascade,
  goods_cents bigint default 0,
  freight_quoted_cents bigint default 0,
  freight_actual_cents bigint default 0,          -- invoice-audit delta
  duties_cents bigint default 0,
  fees_cents bigint default 0                     -- MPF/HMF/brokerage
);

create table logistics_partners (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                             -- broker | forwarder
  name text not null,
  email text,
  quote_count int not null default 0,
  win_count int not null default 0,
  avg_variance_bps int,                           -- quoted vs actual accuracy score
  is_active boolean not null default true
);

create table shipment_bids (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references shipments(id) on delete cascade,
  partner_id uuid not null references logistics_partners(id),
  amount_cents bigint,
  transit_days int,
  quoted_at timestamptz,
  selected boolean not null default false
);

create table customs_docs (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references shipments(id) on delete cascade,
  kind text not null,                             -- commercial_invoice|packing_list|awb|bl|entry
  storage_path text not null,
  validated boolean not null default false,
  validation_report jsonb,
  uploaded_at timestamptz not null default now()
);

create table logistics_exceptions (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid references shipments(id),
  kind text not null,      -- missed_milestone|no_scan|eta_slip|demurrage_risk|doc_invalid|unconfirmed_run
  detail text,
  suggested_action text,
  playbook_key text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Claims ----------
create table claims (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  order_id uuid not null references orders(id),
  status claim_status not null default 'filed',
  lot_numbers text[] not null,
  photos_path text[] not null,
  description text,
  amount_requested_cents bigint,
  fault text,                                     -- client|factory|freight|unknown
  auto_credit_threshold_hit boolean not null default false,
  resolution_cents bigint,
  filed_at timestamptz not null default now(),
  resolved_at timestamptz,
  window_deadline date not null                   -- delivery + 7 days, form-enforced
);

-- ---------- Factory AP (their invoices to us) ----------
create table factory_invoices (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null references factories(id),
  run_id uuid references production_runs(id),
  invoice_ref text,
  amount_cents bigint not null,
  currency text not null default 'USD',
  due_date date,
  three_way_matched boolean,
  mismatch_detail text,
  approved_at timestamptz,                        -- auto if matched
  paid_at timestamptz,
  paid_amount_cents bigint,
  storage_path text,
  submitted_at timestamptz not null default now()
);
