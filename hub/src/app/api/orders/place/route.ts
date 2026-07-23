// ————— ORDER PLACEMENT (client) — the front door of order-to-cash —————
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";
import { priceForClient } from "@/lib/pricing";

const Body = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive().max(100_000_000),
  })).min(1),
  shipAddressId: z.string().uuid(),
  poNumber: z.string().min(1).max(60),
  brandId: z.string().uuid().optional(),
  specialInstructions: z.string().max(2000).optional(),
  weeksOfSupply: z.number().int().positive().max(104).optional(),
  weeklyUsage: z.number().int().positive().optional(),
  artAssetId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("client_id, role, full_name").eq("id", user.id).single();
  if (!prof?.client_id) return NextResponse.json({ error: "no client" }, { status: 403 });
  if (prof.role !== "client_admin") return NextResponse.json({ error: "ordering requires admin role — ask your account admin" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;

  const { data: client } = await sb.from("clients")
    .select("status, hold_active, monthly_volume_estimate").eq("id", prof.client_id).single();
  if (client?.status !== "active")
    return NextResponse.json({ error: "account setup isn't complete — finish signup to place orders" }, { status: 403 });
  if (client.hold_active)
    return NextResponse.json({ error: "ordering is paused on your account — settle the open balance or contact us" }, { status: 403 });

  const { data: addr } = await sb.from("client_addresses")
    .select("id").eq("id", b.shipAddressId).eq("client_id", prof.client_id).single();
  if (!addr) return NextResponse.json({ error: "invalid shipping address" }, { status: 400 });

  const monthlyVol = BigInt(client.monthly_volume_estimate ?? 0);
  const lines: { product_id: string; quantity: number; price_per_cone_microcents: string }[] = [];
  for (const it of b.items) {
    const { data: product } = await sb.from("products")
      .select("id, is_orderable, is_flagship").eq("id", it.productId).single();
    if (!product?.is_orderable)
      return NextResponse.json({ error: "one of those products isn't orderable" }, { status: 400 });
    if (product.is_flagship)
      return NextResponse.json({ error: "the flagship is pre-order — tap 'interested' on the catalog and we'll reach out about partnership" }, { status: 400 });
    let priceMicro: bigint;
    try { priceMicro = await priceForClient(prof.client_id, it.productId, monthlyVol); }
    catch { return NextResponse.json({ error: "pricing unavailable for a product — we've been notified" }, { status: 422 }); }
    lines.push({ product_id: it.productId, quantity: it.quantity, price_per_cone_microcents: priceMicro.toString() });
  }

  const { data: order, error } = await sb.from("orders").insert({
    client_id: prof.client_id, status: "submitted",
    ship_to_address_id: b.shipAddressId, po_number: b.poNumber,
    brand_id: b.brandId ?? null, special_instructions: b.specialInstructions ?? null,
    weeks_of_supply: b.weeksOfSupply ?? null, weekly_usage: b.weeklyUsage ?? null,
    placed_by: user.id,
    art_asset_id: b.artAssetId ?? null,
  }).select("id").single();
  if (error || !order) return NextResponse.json({ error: error?.message ?? "order failed" }, { status: 500 });

  for (const l of lines) await sb.from("order_items").insert({ order_id: order.id, ...l });

  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: prof.full_name,
    action: "order.submitted", entity_table: "orders", entity_id: order.id, client_id: prof.client_id,
    after: { po: b.poNumber, items: lines.length },
  });
  return NextResponse.json({ ok: true, orderId: order.id, message: "Order submitted — you'll get confirmation with your production timeline shortly." });
}
