-- ============================================================
-- SeshSure Hub — Migration 0004
-- ROW-LEVEL SECURITY: the walls, enforced by the database engine
-- Principles: deny by default · client sees only their drawer ·
-- factory sees runs/ledger, never client contacts or sell prices ·
-- staff never sees money rails or margins · owner sees all
-- ============================================================

-- ---------- Helper functions (SECURITY DEFINER, cached per-request) ----------
create or replace function auth_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function auth_client_id() returns uuid
language sql stable security definer set search_path = public as $$
  select client_id from profiles where id = auth.uid()
$$;

create or replace function auth_factory_id() returns uuid
language sql stable security definer set search_path = public as $$
  select factory_id from profiles where id = auth.uid()
$$;

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() = 'owner', false)
$$;

create or replace function is_internal() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() in ('owner','staff'), false)
$$;

create or replace function is_client_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() in ('client_admin','client_ap') and auth_client_id() = cid, false)
$$;

create or replace function is_factory_member(fid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() in ('factory_admin','factory_user') and auth_factory_id() = fid, false)
$$;

-- ---------- Enable RLS on every table (deny-by-default) ----------
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table %I enable row level security', t.tablename);
  end loop;
end $$;

-- ---------- Profiles ----------
create policy prof_self_read on profiles for select using (id = auth.uid() or is_internal());
create policy prof_client_team on profiles for select using (client_id is not null and is_client_member(client_id));
create policy prof_factory_team on profiles for select using (factory_id is not null and is_factory_member(factory_id));
create policy prof_owner_write on profiles for all using (is_owner()) with check (is_owner());
create policy prof_client_admin_invite on profiles for insert
  with check (auth_role() = 'client_admin' and client_id = auth_client_id() and role in ('client_admin','client_ap'));

-- ---------- Clients & satellites ----------
create policy cl_internal on clients for all using (is_internal()) with check (is_internal());
create policy cl_self on clients for select using (is_client_member(id));

create policy cc_internal on client_contacts for all using (is_internal()) with check (is_internal());
create policy cc_self on client_contacts for select using (is_client_member(client_id));
create policy cc_self_write on client_contacts for all using (is_client_member(client_id)) with check (is_client_member(client_id));

create policy ca_internal on client_addresses for all using (is_internal()) with check (is_internal());
create policy ca_self on client_addresses for all using (is_client_member(client_id)) with check (is_client_member(client_id));

create policy clic_internal on client_licenses for all using (is_internal()) with check (is_internal());
create policy clic_self on client_licenses for all using (is_client_member(client_id)) with check (is_client_member(client_id));

create policy cb_internal on client_brands for all using (is_internal()) with check (is_internal());
create policy cb_self on client_brands for all using (is_client_member(client_id)) with check (is_client_member(client_id));

create policy ob_internal on onboarding_progress for all using (is_internal()) with check (is_internal());
create policy ob_self on onboarding_progress for select using (is_client_member(client_id));

-- Documents: client sees + uploads own; internal all
create policy cd_internal on client_documents for all using (is_internal()) with check (is_internal());
create policy cd_self on client_documents for select using (is_client_member(client_id));
create policy cd_self_up on client_documents for insert with check (is_client_member(client_id));

-- Bank accounts: OWNER ONLY on read (not staff); client manages own
create policy cba_owner on client_bank_accounts for all using (is_owner()) with check (is_owner());
create policy cba_self on client_bank_accounts for select using (is_client_member(client_id));
create policy cba_self_add on client_bank_accounts for insert with check (is_client_member(client_id));
create policy cba_self_verify on client_bank_accounts for update
  using (is_client_member(client_id)) with check (is_client_member(client_id));

-- ---------- Agreements & signatures ----------
create policy av_read_all on agreement_versions for select using (true);  -- texts are public to signers
create policy av_owner_write on agreement_versions for insert with check (is_owner());
create policy sig_internal on signatures for select using (is_internal());
create policy sig_self on signatures for select using (client_id is not null and is_client_member(client_id));
create policy sig_factory on signatures for select using (factory_id is not null and is_factory_member(factory_id));
create policy sig_insert_any_auth on signatures for insert with check (auth.uid() is not null);

-- ---------- Catalog & pricing ----------
create policy prod_read on products for select using (true);
create policy prod_owner on products for all using (is_owner()) with check (is_owner());

-- FACTORY COST CARD: owner + that factory only (staff never; clients never)
create policy frc_owner on factory_rate_card for all using (is_owner()) with check (is_owner());

create policy pt_internal on price_tiers for select using (is_internal());
create policy pt_owner on price_tiers for all using (is_owner()) with check (is_owner());

create policy cpo_owner on client_price_overrides for all using (is_owner()) with check (is_owner());
create policy cpo_staff_read on client_price_overrides for select using (is_internal());
-- clients get their prices through a security-definer pricing function, not raw table reads

create policy flr_internal on freight_lane_rates for select using (is_internal());
create policy flr_owner on freight_lane_rates for all using (is_owner()) with check (is_owner());

create policy ps_read_internal on product_specs for select using (is_internal());
create policy ps_owner on product_specs for all using (is_owner()) with check (is_owner());

-- ---------- Quotes & orders ----------
create policy q_internal on quotes for all using (is_internal()) with check (is_internal());
create policy q_self on quotes for select using (client_id is not null and is_client_member(client_id));

create policy qi_internal on quote_items for all using (is_internal()) with check (is_internal());
create policy qi_self on quote_items for select using (exists (select 1 from quotes q where q.id = quote_id and is_client_member(q.client_id)));

create policy o_internal on orders for all using (is_internal()) with check (is_internal());
create policy o_self on orders for select using (is_client_member(client_id));
create policy o_self_create on orders for insert with check (is_client_member(client_id) and status in ('draft','submitted'));
create policy o_self_edit on orders for update using (is_client_member(client_id) and status in ('draft','submitted','quoted'))
  with check (is_client_member(client_id));

create policy oi_internal on order_items for all using (is_internal()) with check (is_internal());
create policy oi_self on order_items for select using (exists (select 1 from orders o where o.id = order_id and is_client_member(o.client_id)));
create policy oi_self_write on order_items for all
  using (exists (select 1 from orders o where o.id = order_id and is_client_member(o.client_id) and o.status in ('draft','submitted','quoted')))
  with check (exists (select 1 from orders o where o.id = order_id and is_client_member(o.client_id)));

create policy orev_internal on order_revisions for select using (is_internal());
create policy orev_self on order_revisions for select using (exists (select 1 from orders o where o.id = order_id and is_client_member(o.client_id)));
create policy orev_insert on order_revisions for insert with check (auth.uid() is not null);

-- ---------- Art & proofs ----------
create policy art_internal on art_assets for all using (is_internal()) with check (is_internal());
create policy art_self on art_assets for all using (client_id is not null and is_client_member(client_id))
  with check (client_id is not null and is_client_member(client_id));

create policy prf_internal on proofs for all using (is_internal()) with check (is_internal());
create policy prf_self on proofs for select using (exists (select 1 from orders o where o.id = order_id and is_client_member(o.client_id)));
create policy prf_self_approve on proofs for update
  using (exists (select 1 from orders o where o.id = order_id and is_client_member(o.client_id)))
  with check (exists (select 1 from orders o where o.id = order_id and is_client_member(o.client_id)));

-- ---------- Invoices & payments ----------
create policy inv_internal on invoices for all using (is_internal()) with check (is_internal());
create policy inv_self on invoices for select using (is_client_member(client_id));

create policy ili_internal on invoice_line_items for all using (is_internal()) with check (is_internal());
create policy ili_self on invoice_line_items for select using (exists (select 1 from invoices i where i.id = invoice_id and is_client_member(i.client_id)));

create policy iv_internal on invoice_views for select using (is_internal());
create policy iv_insert on invoice_views for insert with check (auth.uid() is not null);

-- Payments: owner full; staff read-only; client sees + initiates own
create policy pay_owner on payments for all using (is_owner()) with check (is_owner());
create policy pay_staff_read on payments for select using (is_internal());
create policy pay_self on payments for select using (is_client_member(client_id));
create policy pay_self_initiate on payments for insert
  with check (is_client_member(client_id) and method = 'ach' and status in ('authorized','scheduled'));

create policy pal_owner on payment_allocations for all using (is_owner()) with check (is_owner());
create policy pal_read on payment_allocations for select using (
  is_internal() or exists (select 1 from payments p where p.id = payment_id and is_client_member(p.client_id)));
create policy pal_self_insert on payment_allocations for insert
  with check (exists (select 1 from payments p where p.id = payment_id and is_client_member(p.client_id)));

create policy aa_internal on ach_authorizations for select using (is_internal());
create policy aa_self on ach_authorizations for select using (is_client_member(client_id));
create policy aa_insert on ach_authorizations for insert with check (auth.uid() is not null);

create policy ab_owner on ach_batches for all using (is_owner()) with check (is_owner());

create policy cr_internal on account_credits for select using (is_internal());
create policy cr_owner on account_credits for all using (is_owner()) with check (is_owner());
create policy cr_self on account_credits for select using (is_client_member(client_id));

-- ---------- Factory world ----------
create policy fac_owner on factories for all using (is_owner()) with check (is_owner());
create policy fac_self on factories for select using (is_factory_member(id));
create policy fac_staff on factories for select using (is_internal());

-- Runs: internal all; factory their own. CLIENTS NEVER (they see order stages, not runs)
create policy run_internal on production_runs for all using (is_internal()) with check (is_internal());
create policy run_factory on production_runs for select using (is_factory_member(factory_id));
create policy run_factory_update on production_runs for update
  using (is_factory_member(factory_id)) with check (is_factory_member(factory_id));

create policy ro_internal on run_orders for select using (is_internal());
create policy ro_factory on run_orders for select using (exists (select 1 from production_runs r where r.id = run_id and is_factory_member(r.factory_id)));
create policy ro_owner_write on run_orders for all using (is_owner()) with check (is_owner());

create policy lot_internal on lots for all using (is_internal()) with check (is_internal());
create policy lot_factory on lots for all
  using (exists (select 1 from production_runs r where r.id = run_id and is_factory_member(r.factory_id)))
  with check (exists (select 1 from production_runs r where r.id = run_id and is_factory_member(r.factory_id)));
create policy lot_client_read on lots for select using (exists (
  select 1 from run_orders ro join orders o on o.id = ro.order_id
  where ro.run_id = lots.run_id and is_client_member(o.client_id)));

-- ---------- Freight ----------
create policy shp_internal on shipments for all using (is_internal()) with check (is_internal());
create policy shp_factory on shipments for select using (exists (select 1 from production_runs r where r.id = run_id and is_factory_member(r.factory_id)));
create policy shp_factory_update on shipments for update
  using (exists (select 1 from production_runs r where r.id = run_id and is_factory_member(r.factory_id)))
  with check (exists (select 1 from production_runs r where r.id = run_id and is_factory_member(r.factory_id)));
create policy shp_client on shipments for select using (order_id is not null and exists (select 1 from orders o where o.id = shipments.order_id and is_client_member(o.client_id)));

-- Shipment costs: OWNER ONLY (the margin ledger)
create policy sc_owner on shipment_costs for all using (is_owner()) with check (is_owner());

create policy lp_internal on logistics_partners for all using (is_internal()) with check (is_internal());
create policy sb_internal on shipment_bids for all using (is_internal()) with check (is_internal());

create policy cdoc_internal on customs_docs for all using (is_internal()) with check (is_internal());
create policy cdoc_factory on customs_docs for all
  using (exists (select 1 from shipments s join production_runs r on r.id = s.run_id where s.id = shipment_id and is_factory_member(r.factory_id)))
  with check (exists (select 1 from shipments s join production_runs r on r.id = s.run_id where s.id = shipment_id and is_factory_member(r.factory_id)));

create policy lex_internal on logistics_exceptions for all using (is_internal()) with check (is_internal());

-- ---------- Claims ----------
create policy clm_internal on claims for all using (is_internal()) with check (is_internal());
create policy clm_self on claims for select using (is_client_member(client_id));
create policy clm_self_file on claims for insert with check (is_client_member(client_id));
-- factory sees claims routed to their runs (via orders on their runs)
create policy clm_factory on claims for select using (exists (
  select 1 from run_orders ro join production_runs r on r.id = ro.run_id
  where ro.order_id = claims.order_id and is_factory_member(r.factory_id)));

-- ---------- Factory AP ----------
create policy fi_owner on factory_invoices for all using (is_owner()) with check (is_owner());
create policy fi_staff_read on factory_invoices for select using (is_internal());
create policy fi_factory on factory_invoices for select using (is_factory_member(factory_id));
create policy fi_factory_submit on factory_invoices for insert with check (is_factory_member(factory_id));

-- ---------- Collections/legal: INTERNAL ONLY, money actions owner ----------
create policy rem_internal on reminders for all using (is_internal()) with check (is_internal());
create policy ptp_internal on promises_to_pay for all using (is_internal()) with check (is_internal());
create policy case_internal on collections_cases for select using (is_internal());
create policy case_owner on collections_cases for all using (is_owner()) with check (is_owner());
create policy cdef_internal on case_defendants for select using (is_internal());
create policy cdef_owner on case_defendants for all using (is_owner()) with check (is_owner());
create policy cev_internal on case_events for select using (is_internal());
create policy cev_owner on case_events for all using (is_owner()) with check (is_owner());
create policy jud_owner on judgments for all using (is_owner()) with check (is_owner());
create policy jud_staff on judgments for select using (is_internal());
create policy juda_owner on judgment_actions for all using (is_owner()) with check (is_owner());
create policy set_owner on settlements for all using (is_owner()) with check (is_owner());
create policy pp_owner on payment_plans for all using (is_owner()) with check (is_owner());
create policy pp_client_read on payment_plans for select using (is_client_member(client_id));
create policy pi_owner on plan_installments for all using (is_owner()) with check (is_owner());
create policy pi_client_read on plan_installments for select using (exists (select 1 from payment_plans p where p.id = plan_id and is_client_member(p.client_id)));

-- ---------- Referrals ----------
create policy rc_internal on referral_codes for all using (is_internal()) with check (is_internal());
create policy rc_self on referral_codes for select using (is_client_member(client_id));
create policy re_internal on referral_earnings for select using (is_internal());
create policy re_owner on referral_earnings for all using (is_owner()) with check (is_owner());
create policy re_self on referral_earnings for select using (is_client_member(referrer_client_id));

-- ---------- Inventory ----------
create policy il_internal on inventory_locations for all using (is_internal()) with check (is_internal());
create policy im_internal on inventory_moves for all using (is_internal()) with check (is_internal());
create policy ssa_internal on sample_stock_alerts for all using (is_internal()) with check (is_internal());

-- ---------- Threads (separation: each party sees only own threads) ----------
create policy th_internal on threads for all using (is_internal()) with check (is_internal());
create policy th_client on threads for select using (client_id is not null and is_client_member(client_id));
create policy th_client_create on threads for insert with check (client_id is not null and is_client_member(client_id) and factory_id is null);
create policy th_factory on threads for select using (factory_id is not null and is_factory_member(factory_id));
create policy th_factory_create on threads for insert with check (factory_id is not null and is_factory_member(factory_id) and client_id is null);

create policy tm_visible on thread_messages for select using (exists (
  select 1 from threads t where t.id = thread_id and (
    is_internal()
    or (t.client_id is not null and is_client_member(t.client_id))
    or (t.factory_id is not null and is_factory_member(t.factory_id)))));
create policy tm_post on thread_messages for insert with check (exists (
  select 1 from threads t where t.id = thread_id and (
    is_internal()
    or (t.client_id is not null and is_client_member(t.client_id))
    or (t.factory_id is not null and is_factory_member(t.factory_id)))));

create policy le_internal on logged_emails for all using (is_internal()) with check (is_internal());
create policy callog_internal on call_logs for all using (is_internal()) with check (is_internal());
create policy nl_internal on notification_log for select using (is_internal());
create policy nl_insert on notification_log for insert with check (true);  -- system writes via service role anyway

-- ---------- Notes: NEVER cross the wall ----------
create policy notes_internal on notes for all using (is_internal()) with check (is_internal());

-- ---------- Tasks, SOPs, closes, compliance, goals: internal ----------
create policy task_internal on tasks for all using (is_internal()) with check (is_internal());
create policy sop_internal on sops for select using (is_internal());
create policy sop_owner on sops for all using (is_owner()) with check (is_owner());
create policy mc_internal on monthly_closes for all using (is_internal()) with check (is_internal());
create policy cdl_internal on compliance_deadlines for all using (is_internal()) with check (is_internal());

-- Goals & margins: OWNER ONLY (staff never sees targets/margins)
create policy gs_owner on goal_settings for all using (is_owner()) with check (is_owner());

-- Strategic CRM: OWNER ONLY
create policy scrm_owner on strategic_contacts for all using (is_owner()) with check (is_owner());

-- ---------- Flagship, feedback, exchange ----------
create policy fla_internal on flagship_interest for all using (is_internal()) with check (is_internal());
create policy fla_self on flagship_interest for select using (client_id is not null and is_client_member(client_id));
create policy fla_self_add on flagship_interest for insert with check (client_id is not null and is_client_member(client_id));

create policy fb_internal on feedback for all using (is_internal()) with check (is_internal());
create policy fb_self on feedback for all using (is_client_member(client_id)) with check (is_client_member(client_id));

create policy ex_internal on exchange_listings for all using (is_internal()) with check (is_internal());
create policy ex_clients_browse on exchange_listings for select using (auth_role() in ('client_admin','client_ap') and status = 'listed');
create policy ex_self on exchange_listings for all using (is_client_member(seller_client_id)) with check (is_client_member(seller_client_id));

-- ---------- Audit spine ----------
create policy al_owner_read on activity_log for select using (is_owner());
create policy al_insert on activity_log for insert with check (auth.uid() is not null);

-- ---------- Entities & counters: owner ----------
create policy ent_internal on entities for select using (is_internal());
create policy ent_owner on entities for all using (is_owner()) with check (is_owner());
create policy ic_owner on invoice_counters for all using (is_owner()) with check (is_owner());
