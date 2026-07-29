-- 0040: ARCADE print partner (sticker converter) accounts + the PRINT GATE
-- as an object. A print run is created when the owner assigns an approved
-- arcade order to a converter; the SOP's proof→print→reconcile→destroy
-- sequence is the run's status machine. Registry (Phase 1c) attaches to
-- this same run — the converter never sees words-to-codes mapping beyond
-- the print files they're handed, and NOBODY sees golden placement.
-- 'converter_admin' added to user_role in a separate statement.

create table converters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table profiles add column if not exists converter_id uuid references converters(id);

create or replace function is_converter_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select converter_id from profiles where id = auth.uid()) = cid, false)
$$;

create type print_run_status as enum
  ('queued','proofing','proof_submitted','proof_approved','printing','printed','overage_logged','complete','stopped');

create table arcade_print_runs (
  id uuid primary key default gen_random_uuid(),
  run_number text unique,                         -- PRN-xxxx
  order_id uuid not null references arcade_orders(id),
  converter_id uuid not null references converters(id),
  status print_run_status not null default 'queued',
  total_peels int not null,
  proof_submitted_at timestamptz,
  proof_note text,                                -- converter's proof declaration
  proof_approved_at timestamptz,                  -- SeshSure act (100/100 sandbox redeem)
  proof_approved_by uuid references profiles(id),
  printed_at timestamptz,
  printed_roll_count int,                         -- converter-declared, reconciled at gate
  overage_count int,
  destruction_log_path text,                      -- signed destruction log upload
  overage_logged_at timestamptz,
  stop_reason text,                               -- gate variance = full stop
  notes text,
  created_at timestamptz not null default now()
);
create index print_runs_converter on arcade_print_runs(converter_id, created_at desc);
create index print_runs_order on arcade_print_runs(order_id);

alter table converters enable row level security;
alter table arcade_print_runs enable row level security;

create policy conv_internal on converters for all using (is_internal()) with check (is_internal());
create policy conv_self on converters for select using (is_converter_member(id));

create policy prn_internal on arcade_print_runs for all using (is_internal()) with check (is_internal());
create policy prn_converter_select on arcade_print_runs for select using (is_converter_member(converter_id));
create policy prn_converter_update on arcade_print_runs for update
  using (is_converter_member(converter_id)) with check (is_converter_member(converter_id));

-- Converter may read the SPEC of orders assigned to them (artwork, counts,
-- format) — not client identity beyond what the run shows, not tiers/words
-- (those arrive as print files in 1c). Column discipline enforced app-side.
create policy arc_ord_converter_select on arcade_orders for select
  using (exists (select 1 from arcade_print_runs r where r.order_id = arcade_orders.id and is_converter_member(r.converter_id)));
