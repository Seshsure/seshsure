// Client price resolution: per-client override → volume tier → error (never guesses).
// Pricing tables are internal-only under RLS (prices are never client-readable).
// The lookup runs service-role: it returns exactly one computed price for one
// client+product — the table stays sealed, the answer flows.
import { createClient } from "@supabase/supabase-js";

const pricingDb = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function priceForClient(clientId: string, productId: string, monthlyVolume: bigint) {
  const sb = pricingDb();
  const { data: ovr } = await sb.from("client_price_overrides")
    .select("price_per_cone_microcents")
    .eq("client_id", clientId).eq("product_id", productId)
    .order("effective_at", { ascending: false }).limit(1).maybeSingle();
  if (ovr) return BigInt(ovr.price_per_cone_microcents);

  const { data: tier } = await sb.from("price_tiers")
    .select("price_per_cone_microcents, monthly_volume_min")
    .eq("product_id", productId)
    .lte("monthly_volume_min", monthlyVolume.toString())
    .order("monthly_volume_min", { ascending: false }).limit(1).maybeSingle();
  if (tier) return BigInt(tier.price_per_cone_microcents);

  throw new Error(`no price configured for product ${productId}`);
}
