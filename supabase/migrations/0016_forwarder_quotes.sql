-- Migration 0016 — forwarder-facing quote intake (NTG-pattern, tokenized, no accounts)
alter table freight_rfqs add column if not exists incoterm text;
alter table freight_rfqs add column if not exists dims_note text;          -- '85 x 53 x 54 in, 34 crates'
alter table freight_rfqs add column if not exists stackable boolean;
alter table freight_rfqs add column if not exists hazmat boolean default false;

alter table freight_bids add column if not exists valid_until date;
alter table freight_bids add column if not exists eta_pickup date;
alter table freight_bids add column if not exists eta_delivery date;
alter table freight_bids add column if not exists quoted_by_name text;

create table if not exists forwarder_quote_links (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references freight_rfqs(id) on delete cascade,
  forwarder_id uuid not null references forwarders(id),
  token text not null unique default encode(gen_random_bytes(24),'hex'),
  expires_at timestamptz not null default now() + interval '14 days',
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table forwarder_quote_links enable row level security;
create policy fql_internal on forwarder_quote_links for all using (is_internal()) with check (is_internal());
