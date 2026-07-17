// ————— DISPUTE FILING (client) — SS-D numbers, window flags, SLA stamps —————
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({
  orderId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  lotNumber: z.string().max(40).optional(),
  issueTypes: z.array(z.string()).min(1),
  description: z.string().min(10).max(4000),
  qtyAffectedUnits: z.number().int().positive().optional(),
  qtyAffectedCases: z.number().int().positive().optional(),
  pctInspected: z.number().int().min(1).max(100).optional(),
  discovery: z.string().max(2000).optional(),
  productionStopped: z.boolean().default(false),
  desiredResolution: z.enum(["replacement","credit","refund","other"]).optional(),
  batchBehavior: z.string().max(1000).optional(),
  mediaPaths: z.array(z.string()).min(1, "photos are required — they protect you"),
  mediaKinds: z.array(z.enum(["photo","video"])).optional(),
});

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("client_id, full_name").eq("id", user.id).single();
  if (!prof?.client_id) return NextResponse.json({ error: "no client" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;

  // window math: days since delivery — outside 7 days FLAGS, never hard-rejects (Rob's rule)
  let days: number | null = null;
  let runId: string | null = null;
  if (b.orderId) {
    const { data: order } = await sb.from("orders")
      .select("id, client_id").eq("id", b.orderId).single();
    if (!order || order.client_id !== prof.client_id)
      return NextResponse.json({ error: "order not found" }, { status: 404 });
    const { data: ship } = await sb.from("shipments")
      .select("delivered_at").eq("order_id", b.orderId).not("delivered_at", "is", null)
      .order("delivered_at", { ascending: false }).limit(1).maybeSingle();
    if (ship?.delivered_at) days = Math.floor((Date.now() - new Date(ship.delivered_at).getTime()) / 864e5);
    const { data: ro } = await sb.from("run_orders").select("run_id").eq("order_id", b.orderId).maybeSingle();
    runId = ro?.run_id ?? null;
  }

  const { data: n } = await sb.rpc("claim_counter", { counter_key: "dispute" });
  const disputeNumber = `SS-D-${n}`;
  const now = new Date();
  const ackDue = new Date(now.getTime() + 24 * 36e5);
  const resDue = new Date(now.getTime() + 5 * 864e5);

  const { data: dispute, error } = await sb.from("disputes").insert({
    dispute_number: disputeNumber, client_id: prof.client_id,
    order_id: b.orderId ?? null, invoice_id: b.invoiceId ?? null, run_id: runId,
    lot_number: b.lotNumber ?? null, filed_by: user.id,
    days_since_delivery: days,
    window_status: days !== null && days > 7 ? "outside_window_review" : "in_window",
    issue_types: b.issueTypes, description: b.description,
    qty_affected_units: b.qtyAffectedUnits ?? null, qty_affected_cases: b.qtyAffectedCases ?? null,
    pct_inspected: b.pctInspected ?? null, discovery: b.discovery ?? null,
    production_stopped: b.productionStopped, desired_resolution: b.desiredResolution ?? null,
    batch_behavior: b.batchBehavior ?? null,
    urgency: b.productionStopped ? "urgent" : "normal",
    ack_due_at: ackDue.toISOString(), resolution_due_at: resDue.toISOString(),
  }).select("id").single();
  if (error || !dispute) return NextResponse.json({ error: error?.message }, { status: 500 });

  const hasPhoto = !b.mediaKinds || b.mediaKinds.some(k => k === "photo");
  if (!hasPhoto) return NextResponse.json({ error: "at least one PHOTO is required (video alone isn't enough)" }, { status: 400 });
  for (const [i, path] of b.mediaPaths.entries()) {
    if (!path.startsWith(`${prof.client_id}/`)) continue;   // path must live in the client's own folder
    await sb.from("dispute_media").insert({
      dispute_id: dispute.id, path, uploaded_by: user.id,
      media_kind: b.mediaKinds?.[i] ?? "photo",
    });
  }
  if (b.invoiceId) {
    await sb.from("invoices").update({ dispute_paused: true }).eq("id", b.invoiceId);
  }
  await sb.from("dispute_events").insert({
    dispute_id: dispute.id, actor_side: "client", actor_profile_id: user.id,
    action: "filed", detail: { window_days: days, urgent: b.productionStopped },
  });
  await sb.from("tasks").insert({
    title: `${b.productionStopped ? "🔴 URGENT " : ""}Dispute ${disputeNumber} filed — ack due in 24h`,
    kind: "dispute", related_id: dispute.id, client_id: prof.client_id, auto_generated: true,
    due_on: ackDue.toISOString().slice(0, 10),
  });
  return NextResponse.json({
    ok: true, disputeNumber,
    message: "Dispute received. QUARANTINE the affected product — don't use or discard it; we may need samples returned. You'll hear from us within one business day.",
  });
}
