-- Migration 0019 — per-invoice dunning pause (owner-resolved matters stay quiet)
alter table invoices add column if not exists dunning_paused boolean not null default false;
