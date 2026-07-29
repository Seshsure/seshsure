-- 0034: freight forwarders get real logins for shipment custody. Bidding
-- stays tokenized (sealed bids need no accounts), but the awarded forwarder
-- updating ETAs / port arrival / customs status is ongoing operational
-- write access — that deserves an authenticated, RLS-scoped identity.
-- NOTE: 'forwarder_admin' added to user_role enum in a separate statement
-- (Postgres forbids using a new enum value in the same transaction).
-- delivered_at is deliberately NOT forwarder-writable anywhere: it stamps
-- invoice due-date clocks (money-critical), so delivery confirmation stays
-- internal, evidenced by POD.

alter table profiles add column if not exists forwarder_id uuid references forwarders(id);
alter table shipments add column if not exists forwarder_id uuid references forwarders(id);

create or replace function is_forwarder_member(fid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select forwarder_id from profiles where id = auth.uid()) = fid, false)
$$;

-- Forwarder sees and updates ONLY shipments awarded to them. Column-level
-- discipline (which fields they may touch) is enforced in the API layer;
-- row-level isolation is enforced here.
create policy shp_forwarder_select on shipments for select
  using (forwarder_id is not null and is_forwarder_member(forwarder_id));
create policy shp_forwarder_update on shipments for update
  using (forwarder_id is not null and is_forwarder_member(forwarder_id))
  with check (forwarder_id is not null and is_forwarder_member(forwarder_id));

-- They can read their own forwarder record (name on their portal), nothing else.
create policy fwd_self on forwarders for select using (is_forwarder_member(id));
