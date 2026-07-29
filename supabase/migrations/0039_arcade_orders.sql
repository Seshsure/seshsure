-- 0039: ARCADE Phase 1b — producer orders + the standard word pool.
-- An order is the producer's complete ask (SOP order-form fields, prizes
-- deliberately absent — prizes are the producer's business, never ours).
-- Review is one consolidated decision: approve, or ONE revision note.
-- Word pool: PLACEHOLDER seed pending "Peel Word Pool v2" — structure is
-- final, contents will be replaced wholesale.

create type arcade_order_status as enum
  ('draft','submitted','revision_requested','approved','cancelled');

create table arcade_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique,                    -- ARC-xxxx assigned at submit
  client_id uuid not null references clients(id),
  status arcade_order_status not null default 'draft',
  artwork_path text,                           -- dieline artwork in 'art' bucket
  use_standard_mix boolean not null default true,
  custom_words jsonb not null default '[]',    -- [{word, category}]
  tiers jsonb not null default '{}',           -- {common:{count},uncommon:{count},rare:{count,picks[]},epic:{count,picks[]},legendary:{count,picks[]},golden:{word}}
  hunt_sentence text,                          -- optional launch hunt
  qty_packs int not null default 1,            -- 800-cone master packs
  retail_format text not null default '3' check (retail_format in ('1','3')),
  ship_to text,
  needed_by date,
  sale_states text[] not null default '{}',
  notes text,
  submitted_at timestamptz,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  revision_note text,                          -- ONE consolidated note per SOP
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index arcade_orders_client on arcade_orders(client_id, created_at desc);
create index arcade_orders_status on arcade_orders(status);

create table arcade_word_pool (
  word text primary key,
  category text not null check (category in ('glue','verb','noun','flavor')),
  active boolean not null default true
);
comment on table arcade_word_pool is 'PLACEHOLDER seed — replace wholesale with Peel Word Pool v2 when provided';

insert into arcade_word_pool (word, category) values
  ('THE','glue'),('A','glue'),('MY','glue'),('WE','glue'),('GOT','glue'),('AND','glue'),
  ('TO','glue'),('IN','glue'),('ON','glue'),('IT','glue'),('IS','glue'),('YOU','glue'),
  ('ME','glue'),('UP','glue'),('OUT','glue'),('ALL','glue'),('FOR','glue'),('WITH','glue'),
  ('PUFF','verb'),('PEEL','verb'),('PASS','verb'),('ROLL','verb'),('LIGHT','verb'),
  ('SPARK','verb'),('BLAZE','verb'),('SHARE','verb'),('CHILL','verb'),('VIBE','verb'),
  ('RISE','verb'),('GLOW','verb'),('DRIFT','verb'),('FLOAT','verb'),('LAUGH','verb'),
  ('DREAM','verb'),('RELAX','verb'),('BREATHE','verb'),
  ('SESH','noun'),('CONE','noun'),('PAPER','noun'),('FLAME','noun'),('CLOUD','noun'),
  ('SMOKE','noun'),('LEAF','noun'),('CREW','noun'),('CIRCLE','noun'),('SUNSET','noun'),
  ('MOON','noun'),('STAR','noun'),('WAVE','noun'),('PEAK','noun'),('HAZE','noun'),
  ('GOLD','flavor'),('MAGIC','flavor'),('COSMIC','flavor'),('GOOD','flavor'),
  ('TIME','flavor'),('NIGHT','flavor'),('FRIEND','flavor'),('SMOOTH','flavor');

alter table arcade_orders enable row level security;
alter table arcade_word_pool enable row level security;

create policy arc_ord_internal on arcade_orders for all
  using (is_internal()) with check (is_internal());
-- Clients: see own orders; create/edit drafts only while access is approved.
create policy arc_ord_client_select on arcade_orders for select
  using (client_id = (select client_id from profiles where id = auth.uid()));
create policy arc_ord_client_insert on arcade_orders for insert
  with check (
    client_id = (select client_id from profiles where id = auth.uid())
    and exists (select 1 from arcade_access a where a.client_id = arcade_orders.client_id and a.status = 'approved'));
create policy arc_ord_client_update on arcade_orders for update
  using (client_id = (select client_id from profiles where id = auth.uid())
    and status in ('draft','revision_requested'))
  with check (client_id = (select client_id from profiles where id = auth.uid()));
-- Everyone signed-in can read the pool (the composer needs it); only internal writes.
create policy arc_pool_read on arcade_word_pool for select using (auth.uid() is not null);
create policy arc_pool_internal on arcade_word_pool for all
  using (is_internal()) with check (is_internal());
