-- Migration 0020 — theirs/ours: factory cost tied to each client invoice
alter table invoices add column if not exists factory_cost_cents bigint;  -- null = not yet set
