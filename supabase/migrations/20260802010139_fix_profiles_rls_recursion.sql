-- FIX: infinite recursion (42P17) on profiles SELECT.
-- prof_same_client / prof_same_factory / prof_same_forwarder each subqueried
-- profiles inside a profiles policy -> every user-scoped profile read 500'd,
-- which made middleware treat all logins as "inactive" and bounce to /login.
-- Teammate visibility is already (and safely) provided by the SECURITY DEFINER
-- member functions; forwarder gets the same treatment here.

drop policy if exists prof_same_client on profiles;
drop policy if exists prof_same_factory on profiles;
drop policy if exists prof_same_forwarder on profiles;

create policy prof_forwarder_team on profiles for select
  using (forwarder_id is not null and is_forwarder_member(forwarder_id));
