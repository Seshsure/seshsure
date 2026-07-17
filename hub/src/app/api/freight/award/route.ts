import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({ rfqId: z.string().uuid(), bidId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (prof?.role !== "owner") return NextResponse.json({ error: "owner only" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const { data: bid } = await sb.from("freight_bids")
    .select("id, forwarder_id, all_in_cents, rfq_id").eq("id", parsed.data.bidId).single();
  if (!bid || bid.rfq_id !== parsed.data.rfqId) return NextResponse.json({ error: "bid not found" }, { status: 404 });

  const { data: rfq } = await sb.from("freight_rfqs")
    .select("id, status, run_id, shipment_id").eq("id", parsed.data.rfqId).single();
  if (!rfq || rfq.status !== "open") return NextResponse.json({ error: "rfq not open" }, { status: 400 });

  await sb.from("freight_rfqs").update({
    status: "awarded", awarded_forwarder_id: bid.forwarder_id, awarded_at: new Date().toISOString(),
  }).eq("id", rfq.id);

  if (rfq.shipment_id) {
    await sb.from("shipments").update({ awarded_freight_cents: bid.all_in_cents }).eq("id", rfq.shipment_id);
  } else if (rfq.run_id) {
    await sb.from("shipments").insert({
      run_id: rfq.run_id, status: "booking", awarded_freight_cents: bid.all_in_cents,
    });
  }
  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: prof.full_name,
    action: "freight.awarded", entity_table: "freight_rfqs", entity_id: rfq.id,
    after: { forwarder: bid.forwarder_id, all_in_cents: bid.all_in_cents },
  });
  return NextResponse.json({ ok: true });
}
