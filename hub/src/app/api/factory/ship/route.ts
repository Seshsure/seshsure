// ————— FACTORY MARKS RUN SHIPPED — with the identifiers or not at all —————
// The forcing function in API form: no valid AWB / container / tracking
// number, no shipped status. Inserts into the freight desk's shipments
// spine (factory INSERT policy scoped to own runs via RLS). Mode-specific
// identifier requirements live here, not in a DB check, so legacy blind
// rows stay updatable. Owner-side customs/cost fields are NOT accepted.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";
import { validateAwb, validateContainer } from "@/lib/freight-tracking";

const Body = z.object({
  runId: z.string().uuid(),
  mode: z.enum(["air", "sea", "domestic_parcel"]),
  awb: z.string().max(20).optional(),
  containerNo: z.string().max(15).optional(),
  blNo: z.string().max(40).optional(),
  courierTracking: z.string().max(40).optional(),
  carrier: z.string().min(2).max(60),
  etd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  eta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(300).optional(),
});

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const b = parsed.data;

  // Mode-specific identifier validation with human-readable errors.
  let awb: string | null = null, containerNo: string | null = null;
  if (b.mode === "air") {
    const v = validateAwb(b.awb ?? "");
    if (!v.ok) return NextResponse.json({ error: v.reason }, { status: 400 });
    awb = v.formatted!;
  } else if (b.mode === "sea") {
    if (!b.containerNo && !b.blNo)
      return NextResponse.json({ error: "ocean needs a container number or B/L number" }, { status: 400 });
    if (b.containerNo) {
      const v = validateContainer(b.containerNo);
      if (!v.ok) return NextResponse.json({ error: v.reason }, { status: 400 });
      containerNo = v.formatted!;
    }
  } else if (b.mode === "domestic_parcel" && !b.courierTracking) {
    return NextResponse.json({ error: "courier needs a tracking number" }, { status: 400 });
  }
  if (b.etd && b.eta && b.eta < b.etd)
    return NextResponse.json({ error: "ETA can't be before ETD" }, { status: 400 });

  // The generic intl_tracking stays populated so every existing surface
  // that reads it keeps working; structured columns carry the semantics.
  const intl = awb ?? containerNo ?? b.blNo ?? b.courierTracking ?? null;
  const { data: ship, error } = await sb.from("shipments").insert({
    run_id: b.runId, mode: b.mode, awb, container_no: containerNo,
    bl_no: b.blNo ?? null, intl_tracking: intl, carrier: b.carrier,
    etd: b.etd ?? null, eta: b.eta ?? null, created_by: user.id, status: "in_transit",
  }).select("id").single();
  if (error || !ship) return NextResponse.json({ error: "not permitted" }, { status: 403 });

  await sb.from("production_runs").update({ status: "shipped", shipped_at: new Date().toISOString() }).eq("id", b.runId);

  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: "factory", action: "run.shipped",
    entity_table: "production_runs", entity_id: b.runId,
    after: { mode: b.mode, awb, container_no: containerNo, bl_no: b.blNo ?? null, carrier: b.carrier, etd: b.etd, eta: b.eta },
  });
  return NextResponse.json({ ok: true, shipmentId: ship.id });
}
