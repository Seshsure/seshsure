-- Card as a first-class method (Authorize.net rail) + surcharge policy
alter type payment_method add value if not exists 'card';

alter table clients add column card_surcharge_bps int not null default 200;   -- 2% — Colorado cap
alter table clients add column absorb_card_fee boolean not null default false; -- Rob's per-client mercy toggle

comment on column clients.card_surcharge_bps is
  'Convenience fee added to card payments (bps). Colorado caps at 2% or actual cost, whichever lower. Disclosed at payment; compliant-program rules from acquirer apply.';
comment on column clients.absorb_card_fee is
  'true = SeshSure eats the card fee for this client (relationship cost, visible in per-client margin).';
