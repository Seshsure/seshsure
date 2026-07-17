// EasyPost webhook — LIVE tracking path. HMAC verified, timing-safe.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const MILESTONE_MAP: Record<string, string> = {
  in_transit: "departed_origin",
  arrived_at_destination: "arrived_us_port",
  available_for_pickup: "customs_cleared",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
  failure: "exception", error: "exception", return_to_sender: "exception",
};

export async function POST(req: NextRequest) {
  const raw = await req.text();

  const secret = process.env.EASYPOST_WEBHOOK_SECRET;
  if (secret) {
    const sig = req.headers.get("x-hmac-signature") ?? "";
    const expected = "hmac-sha256-hex=" + crypto.createHmac("sha256", secret)
      .update(raw, "utf8").digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sig.padEnd(expected.length)), Buffer.from(expected)))
      return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let event: { description?: string; result?: { id?: string; status?: string; est_delivery_date?: string; tracking_details?: { message?: string; datetime?: string }[] } };
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const trackerId = event?.result?.id;
  const status = event?.result?.status ?? "";
  if (!trackerId) return NextResponse.json({ ok: true });

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: shipment } = await sb.from("shipments")
    .select("id, order_id").eq("easypost_tracker_id", trackerId).maybeSingle();
  if (!shipment) return NextResponse.json({ ok: true });

  const code = MILESTONE_MAP[status];
  const last = event.result?.tracking_details?.slice(-1)[0];
  const when = last?.datetime ?? new Date().toISOString();

  await sb.from("shipments").update({
    last_scan_at: when,
    ...(event.result?.est_delivery_date ? { eta: event.result.est_delivery_date } : {}),
    ...(status === "delivered" ? { delivered_at: when, status: "delivered" } : {}),
    ...(code === "arrived_us_port" ? { arrived_port_at: when } : {}),
  }).eq("id", shipment.id);

  if (code) {
    await sb.from("shipment_milestones").insert({
      shipment_id: shipment.id, code, description: last?.message ?? status,
      occurred_at: when, source: "easypost", raw: event.result ?? {},
    });
  }
  if (code === "exception") {
    await sb.from("logistics_exceptions").insert({
      shipment_id: shipment.id, kind: "carrier_exception", detail: last?.message ?? "carrier exception",
    });
  }
  return NextResponse.json({ ok: true });
}
