-- 0030: structured freight identifiers on the existing shipments spine.
-- The $182K-untracked-PO problem is a capture problem: AWBs live in chat
-- threads because nothing forces them into the system. The freight desk's
-- shipments table already has the lifecycle (milestones, demurrage,
-- delivery); what it lacked was (a) structured identifiers instead of one
-- generic tracking string, and (b) a factory INSERT path so the party who
-- HAS the AWB is the one who records it, at ship time, as a requirement.
-- Identifier requirements per mode are enforced in the API (a DB check
-- would break updates to legacy rows that predate capture).

alter table shipments add column if not exists awb text;           -- air: 3-digit prefix + 8 (check-digit validated app-side)
alter table shipments add column if not exists container_no text;  -- ocean: ISO 6346
alter table shipments add column if not exists bl_no text;         -- ocean: bill of lading
alter table shipments add column if not exists etd date;           -- estimated departure (eta already exists)
alter table shipments add column if not exists forwarder text not null default 'NTG Air & Ocean';
alter table shipments add column if not exists created_by uuid references profiles(id);

-- Factories could already SELECT and UPDATE their runs' shipments but not
-- CREATE them — which is why capture never happened at the source.
create policy shp_factory_insert on shipments for insert
  with check (exists (select 1 from production_runs r where r.id = run_id and is_factory_member(r.factory_id)));
