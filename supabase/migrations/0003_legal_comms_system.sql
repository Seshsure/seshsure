-- ============================================================
-- SeshSure Hub — Migration 0003
-- Reminders & collections, legal suite, referrals, inventory,
-- threads/notifications, tasks, SOPs, goals, audit spine
-- ============================================================

-- ---------- Reminder ladder ----------
create table reminders (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  step text not null,           -- pre_delivery|due|plus3|plus7|plus14|final21|demand30
  scheduled_for date not null,
  sent_at timestamptz,
  paused_reason text,           -- promise_to_pay | dispute_pause | plan
  unique (invoice_id, step)
);

create table promises_to_pay (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id),
  client_id uuid not null references clients(id),
  promised_date date not null,
  kept boolean,                 -- scored on outcome
  logged_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- Legal suite ----------
create table collections_cases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  status case_status not null default 'pre_filing',
  case_number text,
  court text default 'Douglas County, CO',
  invoice_ids uuid[] not null,
  principal_cents bigint not null,
  interest_cents bigint not null default 0,
  demand_letter_path text,
  demand_sent_at timestamptz,
  demand_certified_tracking text,
  filed_at date,
  created_at timestamptz not null default now()
);

create table case_defendants (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references collections_cases(id) on delete cascade,
  name text not null,
  is_individual boolean not null default false,   -- PG defendants named personally
  served_at date,
  answer_deadline date                             -- auto-computed
);

create table case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references collections_cases(id) on delete cascade,
  kind text not null,           -- hearing|filing|service|order|note
  event_date date,
  detail text,
  created_at timestamptz not null default now()
);

create table judgments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references collections_cases(id),
  awarded_cents bigint not null,
  awarded_on date not null,
  interest_rate_bps int not null default 800,     -- configurable per judgment
  satisfied boolean not null default false,
  satisfied_on date
);

create table judgment_actions (
  id uuid primary key default gen_random_uuid(),
  judgment_id uuid not null references judgments(id) on delete cascade,
  kind text not null,           -- garnishment|lien|levy|payment|note
  detail text,
  amount_cents bigint,
  action_date date default current_date
);

create table settlements (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references collections_cases(id),
  client_id uuid not null references clients(id),
  terms_md text not null,
  total_cents bigint not null,
  funds_cleared boolean not null default false,   -- HARD GATE: dismissal blocked until true
  dismissal_filed_at date,
  release_scope text,
  created_at timestamptz not null default now(),
  constraint dismissal_requires_cleared check (dismissal_filed_at is null or funds_cleared)
);

create table payment_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  case_id uuid references collections_cases(id),
  settlement_id uuid references settlements(id),
  interest_frozen boolean not null default true,  -- while honored
  breached_at timestamptz,                        -- resume + accelerate
  stipulation_path text,                          -- auto-generated draft
  created_at timestamptz not null default now()
);

create table plan_installments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references payment_plans(id) on delete cascade,
  due_date date not null,
  amount_cents bigint not null,
  paid_payment_id uuid references payments(id)
);

-- ---------- Referrals ----------
create table referral_codes (
  client_id uuid primary key references clients(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table referral_earnings (                  -- $1 per 1,000 cones, every paid order, forever
  id uuid primary key default gen_random_uuid(),
  referrer_client_id uuid not null references clients(id),
  referred_client_id uuid not null references clients(id),
  order_id uuid not null references orders(id),
  cones bigint not null,
  credit_cents bigint not null,                   -- cones / 1000 * 100
  credited_at timestamptz not null default now()
);

-- ---------- Inventory (stocked mode + samples; single location, multi-ready) ----------
create table inventory_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Parker'
);

create table inventory_moves (                    -- ledger-style; on-hand = sum
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references inventory_locations(id),
  product_id uuid not null references products(id),
  lot_id uuid references lots(id),
  delta bigint not null,                          -- +receive / -ship / ±adjust
  reason text not null,
  reference_id uuid,
  moved_at timestamptz not null default now()
);

create table sample_stock_alerts (
  product_id uuid primary key references products(id),
  min_units bigint not null default 200
);

-- ---------- Threads & messaging (separation rule: party ↔ hub only) ----------
create table threads (
  id uuid primary key default gen_random_uuid(),
  party text not null,                            -- client | factory
  client_id uuid references clients(id),
  factory_id uuid references factories(id),
  order_id uuid references orders(id),
  invoice_id uuid references invoices(id),
  run_id uuid references production_runs(id),
  subject text,
  created_at timestamptz not null default now(),
  constraint one_party check ((client_id is null) <> (factory_id is null))
);

create table thread_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references threads(id) on delete cascade,
  sender_profile_id uuid references profiles(id),
  body text not null,
  is_from_seshsure boolean not null,
  created_at timestamptz not null default now()
);

create table logged_emails (                      -- BCC-capture into records
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id),
  from_addr text, to_addr text, subject text, body text,
  received_at timestamptz not null default now()
);

create table call_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id),
  outcome text,
  notes text,
  next_call date,
  logged_by uuid references profiles(id),
  called_at timestamptz not null default now()
);

create table notification_log (
  id uuid primary key default gen_random_uuid(),
  recipient text not null,
  template_key text not null,
  subject text,
  related_id uuid,
  status text not null default 'sent',
  sent_at timestamptz not null default now()
);

-- ---------- Notes & tasks ----------
create table notes (                              -- ALWAYS private (RLS: internal only)
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id),
  factory_id uuid references factories(id),
  body text not null,
  pinned boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text,                                      -- follow_up|certified_mail|court|close_item|winback|generic
  client_id uuid references clients(id),
  related_id uuid,
  due_on date,
  completed_at timestamptz,
  auto_generated boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- SOPs, IP docket, continuity ----------
create table sops (
  id uuid primary key default gen_random_uuid(),
  sop_key text not null,
  title text not null,
  version int not null default 1,
  owner text not null default 'Rob',
  review_due date,
  body_md text not null,
  unique (sop_key, version)
);

create table monthly_closes (
  id uuid primary key default gen_random_uuid(),
  period text not null unique,                    -- '2026-07'
  checklist jsonb not null,
  completed_at timestamptz
);

create table compliance_deadlines (               -- IP docket + registrations & renewals
  id uuid primary key default gen_random_uuid(),
  kind text not null,                             -- patent_maintenance|trademark|sos_report|dba|ace|other
  title text not null,
  due_on date not null,
  alert_days int[] not null default '{90,60,30,7}',
  completed_at timestamptz,
  notes text
);

-- ---------- Goals & strategic CRM ----------
create table goal_settings (
  key text primary key,                           -- unit_milestone|unit_line|revenue_annual|margin_contract|margin_flagship
  value_numeric numeric not null,
  updated_at timestamptz not null default now()
);
insert into goal_settings values
  ('unit_milestone_monthly', 3000000, now()),
  ('unit_line_monthly', 10000000, now()),
  ('revenue_annual_cents', 1000000000, now()),
  ('margin_contract_microcents', 25000, now()),   -- 2.5¢ blended
  ('margin_flagship_floor_microcents', 150000, now()); -- 15¢ HARD quote floor

create table strategic_contacts (                 -- acquirer/partner pipeline — OWNER ONLY
  id uuid primary key default gen_random_uuid(),
  company text not null,
  person text, email text,
  kind text not null,                             -- acquirer|distributor|partner
  stage text not null default 'identified',
  next_step text,
  next_step_due date,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------- Flagship interest & testimonials ----------
create table flagship_interest (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id),
  status text not null default 'interested',      -- interested|approved|declined
  created_at timestamptz not null default now()
);

create table feedback (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  order_id uuid references orders(id),
  rating int check (rating between 1 and 5),
  testimonial text,
  marketing_permission boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Dead-stock exchange ----------
create table exchange_listings (
  id uuid primary key default gen_random_uuid(),
  seller_client_id uuid not null references clients(id),
  product_id uuid references products(id),
  description text,
  quantity bigint not null,
  ask_cents bigint not null,
  status text not null default 'listed',          -- listed|sold|withdrawn
  buyer_client_id uuid references clients(id),    -- null buyer → non-client (10% fee)
  fee_cents bigint default 0,
  created_at timestamptz not null default now()
);

-- ---------- Audit spine (APPEND-ONLY) ----------
create table activity_log (
  id bigint generated always as identity primary key,
  actor_profile_id uuid,
  actor_label text,                               -- 'system' for automations
  action text not null,
  entity_table text,
  entity_id uuid,
  client_id uuid,
  before jsonb,
  after jsonb,
  ip inet,
  at timestamptz not null default now()
);
create index activity_client_idx on activity_log(client_id, at desc);

-- Append-only enforcement (evidence tables)
create or replace function forbid_mutation() returns trigger language plpgsql as $$
begin raise exception 'append-only table'; end $$;

create trigger no_update_auth  before update or delete on ach_authorizations for each row execute function forbid_mutation();
create trigger no_update_sigs  before update or delete on signatures         for each row execute function forbid_mutation();
create trigger no_update_log   before update or delete on activity_log       for each row execute function forbid_mutation();
create trigger no_update_views before update or delete on invoice_views      for each row execute function forbid_mutation();
