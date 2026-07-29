-- 0036: "only them and the people they allow" — the roster half. Members of
-- an org can see their own org's member list (name, role, active), so org
-- admins can manage their team without the owner in the loop. Cross-org
-- remains invisible, structurally.
create policy prof_same_client on profiles for select
  using (client_id is not null and client_id = (select client_id from profiles p where p.id = auth.uid()));
create policy prof_same_factory on profiles for select
  using (factory_id is not null and factory_id = (select factory_id from profiles p where p.id = auth.uid()));
create policy prof_same_forwarder on profiles for select
  using (forwarder_id is not null and forwarder_id = (select forwarder_id from profiles p where p.id = auth.uid()));
