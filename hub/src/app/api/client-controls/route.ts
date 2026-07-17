// ————— CLIENT CONTROLS: Rob's per-client switchboard — owner only, every flip audited —————
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({
  clientId: z.string().uuid(),
  patch: z.object({
    accepted_methods: z.array(z.enum(["ach","wire","check","cash","card"])).min(1).optional(),
    auto_hold: z.boolean().optional(),
    hold_active: z.boolean().optional(),
    absorb_card_fee: z.boolean().optional(),
    card_surcharge_bps: z.number().int().min(0).max(200).optional(),   // CO cap
    deposit_pct: z.number().int().min(0).max(100).optional(),
    credit_ceiling_cents: z.string().regex(/^\d+$/).nullable().optional(),
    expected_reorder_weeks: z.number().int().min(1).max(52).optional(),
    watch_flag: z.boolean().optional(),
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
  const { clientId, patch } = parsed.data;

  const { data: before } = await sb.from("clients")
    .select(Object.keys(patch).join(",")).eq("id", clientId).single();
  const { error } = await sb.from("clients").update(patch).eq("id", clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: prof.full_name,
    action: "client.controls_changed", entity_table: "clients", entity_id: clientId, client_id: clientId,
    before: before ?? {}, after: patch,
  });
  return NextResponse.json({ ok: true });
}
