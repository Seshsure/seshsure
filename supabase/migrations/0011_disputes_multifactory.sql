-- ============================================================
-- SeshSure Hub — Migration 0011
-- Disputes module + multi-factory operations (Parts XIV–XV)
-- ============================================================

create type dispute_status as enum ('submitted','under_review','resolution_offered','resolved','denied');
create type dispute_root_cause as enum ('factory_fault','freight_damage','client_side','no_fault_found','goodwill');

create table disputes (
  id uuid primary key default gen_random_uuid(),
  dispute_number text unique,
  client_id uuid not null references clients(id),
  order_id uuid references orders(id),
  invoice_id uuid references invoices(id),
  run_id uuid references production_runs(id),
  lot_number text,
  filed_by uuid references profiles(id),
  filed_at timestamptz not null default now(),
  days_since_delivery int,
  window_status text not null default 'in_window',
  issue_types text[] not null,
  description text,
  qty_affected_units bigint,
  qty_affected_cases int,
  pct_inspected int,
  discovery text,
  production_stopped boolean not null default false,
  desired_resolution text,
  batch_behavior text,
  status dispute_status not null default 'submitted',
  urgency text not null default 'normal',
  factory_response text,
  factory_responded_at timestamptz,
  root_cause dispute_root_cause,
  defect_scope text,
  resolution_type text,
  resolution_value_cents bigint,
  resolved_at timestamptz,
  ack_due_at timestamptz,
  resolution_due_at timestamptz,
  created_at timestamptz not null default now()
);

create table dispute_media (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references disputes(id) on delete cascade,
  path text not null,
  exif_taken_at timestamptz,
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz not null default now()
);

create table dispute_events (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references disputes(id) on delete cascade,
  actor_side text not null,
  actor_profile_id uuid references profiles(id),
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create table dispute_messages (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references disputes(id) on delete cascade,
  author_side text not null,
  author_profile_id uuid references profiles(id),
  body text not null,
  relayed_by_owner boolean not null default false,
  created_at timestamptz not null default now()
);

insert into invoice_counters (key, next_number) values ('dispute', 1) on conflict do nothing;

alter table disputes enable row level security;
alter table dispute_media enable row level security;
alter table dispute_events enable row level security;
alter table dispute_messages enable row level security;

create policy d_owner on disputes for all using (is_internal()) with check (is_internal());
create policy d_client on disputes for select using (is_client_member(client_id));
create policy d_client_file on disputes for insert with check (is_client_member(client_id));
create policy d_factory on disputes for select using (
  run_id is not null and exists (
    select 1 from production_runs r where r.id = run_id and is_factory_member(r.factory_id)));

create policy dm_owner on dispute_media for all using (is_internal()) with check (is_internal());
create policy dm_client on dispute_media for select using (
  exists (select 1 from disputes d where d.id = dispute_id and is_client_member(d.client_id)));
create policy dm_client_up on dispute_media for insert with check (
  exists (select 1 from disputes d where d.id = dispute_id and is_client_member(d.client_id)));
create policy dm_factory on dispute_media for select using (
  exists (select 1 from disputes d join production_runs r on r.id = d.run_id
          where d.id = dispute_id and is_factory_member(r.factory_id)));

create policy de_owner on dispute_events for all using (is_internal()) with check (is_internal());
create policy de_read_client on dispute_events for select using (
  exists (select 1 from disputes d where d.id = dispute_id and is_client_member(d.client_id))
  and actor_side in ('client','owner','system'));

-- THE FIREWALL: factory messages never client-visible; client messages never factory-visible
create policy dmsg_owner on dispute_messages for all using (is_internal()) with check (is_internal());
create policy dmsg_client_read on dispute_messages for select using (
  exists (select 1 from disputes d where d.id = dispute_id and is_client_member(d.client_id))
  and author_side in ('client','owner'));
create policy dmsg_client_write on dispute_messages for insert with check (
  author_side = 'client' and exists (select 1 from disputes d where d.id = dispute_id and is_client_member(d.client_id)));
create policy dmsg_factory_read on dispute_messages for select using (
  exists (select 1 from disputes d join production_runs r on r.id = d.run_id
          where d.id = dispute_id and is_factory_member(r.factory_id))
  and author_side in ('factory','owner'));
create policy dmsg_factory_write on dispute_messages for insert with check (
  author_side = 'factory' and exists (
    select 1 from disputes d join production_runs r on r.id = d.run_id
    where d.id = dispute_id and is_factory_member(r.factory_id)));

-- ———————————————— MULTI-FACTORY ————————————————
alter table factories add column flagship_approved boolean not null default false;
alter table factories add column board_eligible boolean not null default false;
alter table factories add column country text;
alter table factories add column payment_terms text;
alter table factories add column early_pay_discount_bps int;
alter table factories add column currency text not null default 'USD';
alter table factories add column qualified_at timestamptz;

alter table factory_rate_card add column if not exists factory_id uuid references factories(id);

create table run_board_posts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  posted_by uuid references profiles(id),
  specs jsonb not null,
  status text not null default 'open',
  bid_deadline timestamptz,
  awarded_factory_id uuid references factories(id),
  awarded_at timestamptz,
  created_at timestamptz not null default now()
);

create table run_board_bids (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references run_board_posts(id) on delete cascade,
  factory_id uuid not null references factories(id),
  price_per_cone_microcents bigint,
  promise_date date,
  capacity_note text,
  declined boolean not null default false,
  decline_reason text,
  created_at timestamptz not null default now(),
  unique (post_id, factory_id)
);

alter table run_board_posts enable row level security;
alter table run_board_bids enable row level security;

create policy rbp_owner on run_board_posts for all using (is_internal()) with check (is_internal());
create policy rbp_factory on run_board_posts for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.factory_id is not null));

-- SEALED: a factory sees ONLY ITS OWN bid
create policy rbb_owner on run_board_bids for all using (is_internal()) with check (is_internal());
create policy rbb_factory_own on run_board_bids for select using (is_factory_member(factory_id));
create policy rbb_factory_write on run_board_bids for insert with check (is_factory_member(factory_id));
create policy rbb_factory_update on run_board_bids for update using (
  is_factory_member(factory_id) and exists (
    select 1 from run_board_posts p where p.id = post_id and p.status = 'open'));

create view factory_scorecards as
select
  f.id as factory_id,
  f.name,
  count(distinct r.id) filter (where r.status = 'closed') as completed_runs,
  count(distinct d.id) filter (where d.root_cause = 'factory_fault') as fault_disputes,
  sum(ro_qty.units) as units_delivered,
  count(distinct r.id) filter (where r.shipped_at is not null and r.promise_date is not null
    and r.shipped_at::date <= r.promise_date) as on_time_runs,
  count(distinct r.id) filter (where r.shipped_at is not null and r.promise_date is not null) as promised_runs
from factories f
left join production_runs r on r.factory_id = f.id
left join disputes d on d.run_id = r.id
left join lateral (
  select coalesce(sum(oi.quantity),0) as units
  from run_orders ro join order_items oi on oi.order_id = ro.order_id
  where ro.run_id = r.id
) ro_qty on true
group by f.id, f.name;

comment on view factory_scorecards is
  'Computed, never typed. Display rules live in the app: no score under 10 runs; volume beside percentage; trailing-12-month weighting; only Rob-ruled factory_fault counts.';

-- routing: order carries its assigned factory; run placement honors it
alter table orders add column routed_factory_id uuid references factories(id);

-- factory onboarding support
alter table signatures add column if not exists factory_id uuid references factories(id);
create table spec_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null references factories(id),
  spec_version_id uuid not null,
  acknowledged_by uuid references profiles(id),
  acknowledged_at timestamptz not null default now(),
  unique (factory_id, spec_version_id)
);
alter table spec_acknowledgments enable row level security;
create policy sa_owner on spec_acknowledgments for all using (is_internal()) with check (is_internal());
create policy sa_factory on spec_acknowledgments for select using (is_factory_member(factory_id));
create policy sa_factory_ack on spec_acknowledgments for insert with check (is_factory_member(factory_id));

comment on column factories.board_eligible is 'true after a completed, scored qualification run — owner flips it';

alter table production_runs add column if not exists promise_revision_pending date;
alter table production_runs add column if not exists confirmed_at timestamptz;
alter table production_runs add column if not exists bid_price_microcents bigint;
alter table production_runs add column if not exists is_replacement boolean not null default false;
alter table production_runs add column if not exists replaces_run_id uuid;
alter table production_runs add column if not exists zero_cost boolean not null default false;

-- factory statement of account: the interactive line builder + Rob's live mirror
create table factory_statement_lines (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null references factories(id),
  run_id uuid references production_runs(id),
  company_label text not null,
  quantity bigint not null,
  ship_label text,
  rate_per_cone_microcents bigint not null,
  fees_cents bigint not null default 0,
  total_cents bigint not null,
  kind text not null default 'goods',
  discrepancy_flag text,
  added_by uuid references profiles(id),
  settled_at timestamptz,
  created_at timestamptz not null default now()
);
alter table factory_statement_lines enable row level security;
create policy fsl_owner on factory_statement_lines for all using (is_internal()) with check (is_internal());
create policy fsl_factory on factory_statement_lines for select using (is_factory_member(factory_id));
create policy fsl_factory_add on factory_statement_lines for insert with check (is_factory_member(factory_id));
create policy fsl_factory_del on factory_statement_lines for delete using (is_factory_member(factory_id) and settled_at is null);

-- legal: extend EXISTING payment_plans/plan_installments (created in 0003)
-- with the Slow Burn stipulation fields (recovery caught a would-be collision here)
alter table payment_plans add column if not exists case_label text;
alter table payment_plans add column if not exists certified_funds_only boolean not null default true;
alter table payment_plans add column if not exists acceleration boolean not null default true;
alter table payment_plans add column if not exists created_by uuid references profiles(id);
alter table plan_installments add column if not exists cleared_at timestamptz;

alter table invoices add column if not exists interest_frozen boolean not null default false;
