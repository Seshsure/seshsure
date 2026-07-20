// ————— FACTORY SETS PICKUP-READY DATE — own runs only (RLS-enforced) —————
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({ runId: z.string().uuid(), pickupReadyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { runId, pickupReadyDate } = parsed.data;
  if (pickupReadyDate < new Date().toISOString().slice(0, 10))
    return NextResponse.json({ error: "pickup date can't be in the past" }, { status: 400 });

  const { data, error } = await sb.from("production_runs")
    .update({ pickup_ready_date: pickupReadyDate }).eq("id", runId).select("id").single();
  if (error || !data) return NextResponse.json({ error: "not permitted" }, { status: 403 });

  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: "factory", action: "run.pickup_ready_set",
    entity_table: "production_runs", entity_id: runId, after: { pickup_ready_date: pickupReadyDate },
  });
  return NextResponse.json({ ok: true });
}
