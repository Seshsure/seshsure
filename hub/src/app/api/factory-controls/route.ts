// Factory qualification flips — owner only, audited (board_eligible, flagship_approved)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({
  factoryId: z.string().uuid(),
  patch: z.object({
    board_eligible: z.boolean().optional(),
    flagship_approved: z.boolean().optional(),
    is_active: z.boolean().optional(),
  }).refine(p => Object.keys(p).length > 0, "empty patch"),
});

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (prof?.role !== "owner") return NextResponse.json({ error: "owner only" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { factoryId, patch } = parsed.data;

  // guardrail: board eligibility requires a completed run on record
  if (patch.board_eligible === true) {
    const { count } = await sb.from("production_runs")
      .select("id", { count: "exact", head: true }).eq("factory_id", factoryId).eq("status", "closed");
    if (!count) return NextResponse.json({ error: "board eligibility requires a completed qualification run — none on record" }, { status: 422 });
    await sb.from("factories").update({ qualified_at: new Date().toISOString() }).eq("id", factoryId);
  }

  const { data: before } = await sb.from("factories")
    .select("board_eligible, flagship_approved, is_active").eq("id", factoryId).single();
  const { error } = await sb.from("factories").update(patch).eq("id", factoryId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: prof.full_name,
    action: "factory.controls_changed", entity_table: "factories", entity_id: factoryId,
    before: before ?? {}, after: patch,
  });
  return NextResponse.json({ ok: true });
}
