// Invoice creation — SS numbers assigned atomically at send, gap-free.
import { SupabaseClient } from "@supabase/supabase-js";
import { conesToCents, pctOf } from "./money";

export async function nextNumber(sb: SupabaseClient, key: "invoice" | "order"): Promise<string> {
  const { data, error } = await sb.rpc("claim_counter", { counter_key: key });
  if (error || data === null) throw new Error(`counter claim failed: ${error?.message}`);
  return key === "invoice" ? `SS-${data}` : `SS-O-${data}`;
}

export type OrderLine = { productId: string; quantity: bigint; priceMicro: bigint; description: string };

export function orderTotals(lines: OrderLine[], freightCents: bigint, taxBps: bigint, taxable: boolean) {
  const subtotal = lines.reduce((s, l) => s + conesToCents(l.quantity, l.priceMicro), 0n);
  const tax = taxable ? pctOf(subtotal + freightCents, taxBps) : 0n;
  return { subtotal, freight: freightCents, tax, total: subtotal + freightCents + tax };
}

export function splitDeposit(total: bigint, depositPct: number) {
  const deposit = pctOf(total, BigInt(depositPct * 100));
  return { deposit, balance: total - deposit };
}
