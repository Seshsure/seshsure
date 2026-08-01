-- 0042: ACH the Rob way — prenote verification ($0 bank test through the
-- rail itself, replacing micro-deposits: free, no extra vendor) and the 1%
-- ACH discount (a $100 give that saves ~$290 in card fees per $10K — the
-- discount EARNS money by steering volume off cards). Authorization capture
-- lives on the bank account: signed name + timestamp + IP + text version,
-- the NACHA-required evidence trail. Discount is granted only when the
-- ACH CLEARS — a bounced payment earns nothing.
alter table client_bank_accounts add column if not exists prenote_status text not null default 'none'
  check (prenote_status in ('none','queued','sent','verified','failed'));
alter table client_bank_accounts add column if not exists prenote_sent_at timestamptz;
alter table client_bank_accounts add column if not exists prenote_verified_at timestamptz;
alter table client_bank_accounts add column if not exists auth_signed_name text;
alter table client_bank_accounts add column if not exists auth_signed_at timestamptz;
alter table client_bank_accounts add column if not exists auth_ip text;
alter table client_bank_accounts add column if not exists auth_text_version text;

alter table payments add column if not exists ach_discount_cents bigint not null default 0;
alter table payments add column if not exists discount_granted_at timestamptz;
