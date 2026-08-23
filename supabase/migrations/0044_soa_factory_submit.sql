-- 0044: Factory-submitted SOA lines — the other half of the handshake.
-- Lines Rob adds await factory confirmation; lines the factory submits
-- await Rob's approval. status: pending (factory-submitted, not yet in
-- balance) → live (in balance) | rejected (with note, kept for record).
-- cogs_category derived from kind at approval so the landed-cost engine
-- can consume approved charges without re-classification.
alter table factory_statement_lines add column if not exists status text not null default 'live'
  check (status in ('pending','live','rejected'));
alter table factory_statement_lines add column if not exists submitted_by uuid references profiles(id);
alter table factory_statement_lines add column if not exists owner_approved_at timestamptz;
alter table factory_statement_lines add column if not exists reject_note text;
alter table factory_statement_lines add column if not exists cogs_category text
  check (cogs_category in ('goods','services','freight','other') or cogs_category is null);
create index if not exists fsl_status on factory_statement_lines(factory_id, status);
