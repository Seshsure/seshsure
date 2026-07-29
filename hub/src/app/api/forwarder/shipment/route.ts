// ————— FORWARDER UPDATES SHIPMENT STATUS — whitelisted fields only —————
// RLS confines rows (only shipments awarded to their forwarder); this route
// confines COLUMNS. The whitelist is the security boundary: status from a
// fixed vocabulary, dates, and a milestone note. delivered_at is refused by
// omission — delivery stamps invoice due-date clocks, so confirming it
// stays an internal act backed by POD.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const STATUSES = ["booking", "picked_up", "in_transit", "arrived_port", "customs_hold", "released", "delivering"] as const;

const Body = z.object({
  shipmentId: z.string().uuid(),
  status: z.enum(STATUSES).optional(),
  eta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  arrivedPort: z.boolean().optional(),          // true → stamp arrived_port_at now
  note: z.string().min(2).max(300).optional(),  // appended to milestones
});

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const b = parsed.data;

  // Read under RLS: if this isn't their shipment, it doesn't exist.
  const { data: ship } = await sb.from("shipments")
    .select("id, milestones").eq("id", b.shipmentId).single();
  if (!ship) return NextResponse.json({ error: "not found" }, { status: 404 });

  const patch: Record<string, unknown> = { last_scan_at: new Date().toISOString() };
  if (b.status) patch.status = b.status;
  if (b.eta) patch.eta = b.eta;
  if (b.arrivedPort) patch.arrived_port_at = new Date().toISOString();
  if (b.note || b.status) {
    const milestones = Array.isArray(ship.milestones) ? ship.milestones : [];
    patch.milestones = [...milestones, {
      at: new Date().toISOString(), by: "forwarder",
      status: b.status ?? null, note: b.note ?? null,
    }];
  }

  const { error } = await sb.from("shipments").update(patch).eq("id", b.shipmentId);
  if (error) return NextResponse.json({ error: "not permitted" }, { status: 403 });

  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: "forwarder", action: "shipment.updated",
    entity_table: "shipments", entity_id: b.shipmentId,
    after: { status: b.status ?? null, eta: b.eta ?? null, arrived_port: !!b.arrivedPort, note: b.note ?? null },
  });
  return NextResponse.json({ ok: true });
}
