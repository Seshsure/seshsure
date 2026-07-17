// Client price resolution: per-client override → volume tier → error (never guesses).
import { supabaseServer } from "./supabase-server";

export async function priceForClient(clientId: string, productId: string, monthlyVolume: bigint) {
  const sb = supabaseServer();
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
