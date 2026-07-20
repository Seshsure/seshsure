// ————— FACTORY COST ON AN INVOICE — owner only, audited —————
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({ invoiceId: z.string().uuid(), factoryCostUsd: z.number().nonnegative() });

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (prof?.role !== "owner") return NextResponse.json({ error: "owner only" }, { status: 403 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { invoiceId, factoryCostUsd } = parsed.data;
  const cents = Math.round(factoryCostUsd * 100);
  const { data: inv } = await sb.from("invoices").select("id, factory_cost_cents, total_cents").eq("id", invoiceId).single();
  if (!inv) return NextResponse.json({ error: "not found" }, { status: 404 });
  await sb.from("invoices").update({ factory_cost_cents: cents }).eq("id", invoiceId);
  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: prof.full_name ?? "owner",
    action: "invoice.factory_cost_set", entity_table: "invoices", entity_id: invoiceId,
    before: { factory_cost_cents: inv.factory_cost_cents }, after: { factory_cost_cents: cents },
  });
  return NextResponse.json({ ok: true });
}
