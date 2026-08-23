-- 0043: LIVE SOA — one running statement between VMDC and the cone factory,
-- visible to both sides, confirmable line by line. Kills the monthly
-- PDF-reconciliation dance: both parties stare at the same balance.
-- Extends factory_statement_lines (empty, so safely reshaped):
--   · billing_entity: the factory bills through two entities on the same
--     shipments (goods vs services) — every charge carries which one
--   · signed amounts via kind: charges increase the payable, payments and
--     credits decrease it — running balance = sum(signed)
--   · mutual confirmation: factory confirms or disputes each line with a
--     note; a fully-confirmed statement IS the reconciliation
--   · attachments: invoice PDFs / wire receipts per line (evidence)
alter table factory_statement_lines add column if not exists entry_date date not null default current_date;
alter table factory_statement_lines add column if not exists billing_entity text;
alter table factory_statement_lines add column if not exists ref_no text;
alter table factory_statement_lines add column if not exists description text;
alter table factory_statement_lines add column if not exists attachment_path text;
alter table factory_statement_lines add column if not exists factory_confirmed_at timestamptz;
alter table factory_statement_lines add column if not exists factory_confirmed_by uuid references profiles(id);
alter table factory_statement_lines add column if not exists dispute_note text;

-- kind vocabulary (existing column, empty table): charge_goods,
-- charge_services, charge_freight, payment, credit, adjustment, opening_balance
create index if not exists fsl_factory_date on factory_statement_lines(factory_id, entry_date, created_at);

-- Factory members READ their own statement. Confirm/dispute goes through
-- the API only (service role after membership check) — a direct-update
-- policy would let a factory JWT alter amounts, since RLS cannot restrict
-- columns. Read-only at the database, act-through-API by design.
create policy fsl_factory_read on factory_statement_lines for select
  using (is_factory_member(factory_id));
