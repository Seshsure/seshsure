-- 0031: origin port on factories, so a factory's pickup-ready declaration
-- can auto-open a freight RFQ with a real origin instead of a guess.
-- Nullable: cargo_summary falls back to 'TBD' and the desk still quotes.
alter table factories add column if not exists origin_port text;
