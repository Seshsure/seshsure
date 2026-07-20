-- Migration 0023 — packing sheet is the source of truth for cargo data
alter table production_runs add column if not exists packing_cartons int;
alter table production_runs add column if not exists packing_gross_kg numeric;
alter table production_runs add column if not exists packing_dims_note text;
alter table production_runs add column if not exists packing_list_path text;
