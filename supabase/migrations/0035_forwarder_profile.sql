-- 0035: forwarder self-serve profile. Owner creates the account with name +
-- email only; the forwarder fills identity, legal credentials (FMC OTI is
-- required by law for US ocean forwarding — the field doubles as vendor
-- diligence), capabilities, insurance, and remittance. Banking follows the
-- factory wire-fraud discipline: any change freezes payments pending
-- voice confirmation.
alter table forwarders add column if not exists legal_name text;
alter table forwarders add column if not exists dba text;
alter table forwarders add column if not exists address text;
alter table forwarders add column if not exists ops_phone text;
alter table forwarders add column if not exists after_hours_contact text;
alter table forwarders add column if not exists scac_code text;
alter table forwarders add column if not exists iata_number text;
alter table forwarders add column if not exists fmc_oti_number text;
alter table forwarders add column if not exists customs_broker_license text;
alter table forwarders add column if not exists services text[] not null default '{}';
alter table forwarders add column if not exists origin_lanes text;
alter table forwarders add column if not exists insurance_carrier text;
alter table forwarders add column if not exists cargo_coverage_usd bigint;
alter table forwarders add column if not exists wire_details_enc text;
alter table forwarders add column if not exists wire_change_pending boolean not null default false;
alter table forwarders add column if not exists profile_completed_at timestamptz;

-- Self-update: a forwarder member may update their own record. Wire freeze
-- is enforced in the API (sets wire_change_pending on banking changes).
create policy fwd_self_update on forwarders for update
  using (is_forwarder_member(id)) with check (is_forwarder_member(id));
