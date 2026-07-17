-- ============================================================
-- SeshSure Hub — Migration 0008
-- Payment methods per client: ACH portal-pay, wire, check, cash.
-- Banking setup required only for ACH. Cleared-funds discipline
-- is method-agnostic (checks clear, cash receipts logged).
-- ============================================================

alter table clients add column accepted_methods text[] not null default '{ach,wire,check}';
alter table clients add column preferred_method text default 'ach';

-- remit-to lives on the entity (checks payable address)
alter table entities add column checks_payable_to text;
alter table entities add column remit_check_address text;
update entities set
  checks_payable_to = 'Vido Manufacturing and Distribution Corp',
  remit_check_address = '10940 S. Parker Rd, Suite 788, Parker, CO 80134'
where is_default;

-- cash/check receipt record (numbered receipts for cash discipline)
create table payment_receipts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete cascade,
  receipt_number text not null unique,
  method payment_method not null,
  received_by uuid references profiles(id),
  image_path text,
  created_at timestamptz not null default now()
);
alter table payment_receipts enable row level security;
create policy pr_internal on payment_receipts for all using (is_internal()) with check (is_internal());
create policy pr_client on payment_receipts for select using (
  exists (select 1 from payments p where p.id = payment_id and is_client_member(p.client_id)));

comment on column payments.cleared_at is
  'ACH: settle + 2 business days no return. CHECK: bank shows collected funds (not just deposited). CASH: on receipt. Production start, dismissals, and holds all read THIS, never method.';
