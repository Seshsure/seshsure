-- Migration 0027 — products.is_orderable (E2E-caught ghost column #2)
alter table products add column if not exists is_orderable boolean not null default false;
