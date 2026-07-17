-- Atomic, gap-free number claim (row-locked)
create or replace function claim_counter(counter_key text)
returns bigint language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  update invoice_counters set next_number = next_number + 1
  where key = counter_key
  returning next_number - 1 into n;
  if n is null then raise exception 'unknown counter %', counter_key; end if;
  return n;
end $$;
