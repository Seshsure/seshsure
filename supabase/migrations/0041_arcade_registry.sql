-- 0041: THE REGISTRY — one row per peel, the program's single source of
-- truth. Generated at order approval. The physical peel prints only WORD +
-- CODE; tier and golden exist solely in this table, revealed at redemption
-- — which is why the converter can safely receive the full sequenced print
-- manifest. Direct table access is INTERNAL-ONLY; converters get their
-- projection (seq/roll/pack/word/code — never tier, never golden) through
-- the API, which verifies run ownership first.

create table arcade_registry (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references arcade_orders(id),
  seq int not null,                        -- global print sequence 1..N
  roll_no int not null,                    -- 800 peels/roll default (one master case per roll)
  pack_no int not null,                    -- retail pack number within the run
  pos_in_pack int not null,                -- position within the retail pack
  code text not null unique,               -- XXXX-XXXX Crockford base32, crypto-random
  word text not null,
  category text not null,                  -- glue|verb|noun|flavor
  tier text not null,                      -- common|uncommon|rare|epic|legendary|golden — NEVER in converter projection
  is_golden boolean not null default false,
  status text not null default 'minted'    -- minted → (activated → redeemed | void) in Phase 2
    check (status in ('minted','void','activated','redeemed')),
  created_at timestamptz not null default now(),
  unique (order_id, seq)
);
create index arcade_registry_order on arcade_registry(order_id, seq);
create index arcade_registry_word on arcade_registry(order_id, word);

alter table arcade_orders add column if not exists registry_checksum text;
alter table arcade_orders add column if not exists registry_generated_at timestamptz;
alter table arcade_orders add column if not exists registry_rows int;

alter table arcade_registry enable row level security;
-- Internal only. No client policy (producers see aggregates via API later),
-- no converter policy (projection via API strips tier/golden). The golden
-- row is readable ONLY by service role + internal — and no UI renders its
-- position, honoring "no human sees it".
create policy reg_internal on arcade_registry for all
  using (is_internal()) with check (is_internal());
