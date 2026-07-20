// ————— PUBLIC FORWARDER QUOTE INTAKE — token-gated, no account —————
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } });

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (token.length < 20) return NextResponse.json({ error: "bad token" }, { status: 400 });
  const sb = admin();
  const { data: link } = await sb.from("forwarder_quote_links")
    .select("id, expires_at, rfq_id, forwarder_id, forwarders(name), freight_rfqs(id, mode, origin, destination, cartons, weight_kg, ready_date, need_by, incoterm, dims_note, stackable, hazmat, status)")
    .eq("token", token).single();
  if (!link) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (new Date(link.expires_at) < new Date()) return NextResponse.json({ error: "expired" }, { status: 410 });
  const rfq = link.freight_rfqs as unknown as Record<string, unknown>;
  if (rfq.status !== "open") return NextResponse.json({ error: "closed" }, { status: 410 });
  return NextResponse.json({ ok: true, forwarder: (link.forwarders as unknown as { name: string }).name, rfq });
}

const Body = z.object({
  token: z.string().min(20),
  amountUsd: z.number().positive(),
  transitDays: z.number().int().positive().optional(),
  etaPickup: z.string().optional(),
  etaDelivery: z.string().optional(),
  validUntil: z.string(),
  quotedByName: z.string().min(2),
  note: z.string().max(800).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "check required fields" }, { status: 400 });
  const b = parsed.data;
  const sb = admin();
  const { data: link } = await sb.from("forwarder_quote_links")
    .select("id, rfq_id, forwarder_id, expires_at, freight_rfqs(status)").eq("token", b.token).single();
  if (!link) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (new Date(link.expires_at) < new Date()) return NextResponse.json({ error: "expired" }, { status: 410 });
  if ((link.freight_rfqs as unknown as { status: string }).status !== "open")
    return NextResponse.json({ error: "bidding closed" }, { status: 410 });

  await sb.from("freight_bids").upsert({
    rfq_id: link.rfq_id, forwarder_id: link.forwarder_id,
    amount_cents: Math.round(b.amountUsd * 100),
    transit_days: b.transitDays ?? null,
    eta_pickup: b.etaPickup || null, eta_delivery: b.etaDelivery || null,
    valid_until: b.validUntil, quoted_by_name: b.quotedByName, note: b.note ?? null,
  }, { onConflict: "rfq_id,forwarder_id" });
  await sb.from("forwarder_quote_links").update({ used_at: new Date().toISOString() }).eq("id", link.id);
  return NextResponse.json({ ok: true, message: "Quote received — SeshSure will review and award. Thank you." });
}
