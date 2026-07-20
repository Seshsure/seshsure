// ————— FACTORY SETS PICKUP-READY DATE — own runs only (RLS-enforced) —————
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({
  runId: z.string().uuid(),
  pickupReadyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cartons: z.number().int().positive(),
  grossKg: z.number().positive(),
  dimsNote: z.string().min(3).max(200),
  packingListPath: z.string().min(3).optional(),
});

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { runId, pickupReadyDate, cartons, grossKg, dimsNote, packingListPath } = parsed.data;
  if (pickupReadyDate < new Date().toISOString().slice(0, 10))
    return NextResponse.json({ error: "pickup date can't be in the past" }, { status: 400 });

  const { data, error } = await sb.from("production_runs")
    .update({ pickup_ready_date: pickupReadyDate, packing_cartons: cartons, packing_gross_kg: grossKg, packing_dims_note: dimsNote, ...(packingListPath ? { packing_list_path: packingListPath } : {}) }).eq("id", runId).select("id").single();
  if (error || !data) return NextResponse.json({ error: "not permitted" }, { status: 403 });

  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: "factory", action: "run.pickup_ready_set",
    entity_table: "production_runs", entity_id: runId, after: { pickup_ready_date: pickupReadyDate, cartons, gross_kg: grossKg },
  });
  return NextResponse.json({ ok: true });
}
