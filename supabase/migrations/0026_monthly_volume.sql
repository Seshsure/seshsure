-- Migration 0026 — column the order-place route depends on (E2E-caught)
alter table clients add column if not exists monthly_volume_estimate bigint;
