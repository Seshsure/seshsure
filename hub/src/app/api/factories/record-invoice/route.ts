// ————— RECORD A FACTORY INVOICE — owner-side entry (historical or paper) —————
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({
  factoryId: z.string().uuid(),
  invoiceRef: z.string().min(1),
  amountUsd: z.number().positive(),
  invoiceDate: z.string(),          // used as submitted_at anchor for period math
  paid: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (prof?.role !== "owner") return NextResponse.json({ error: "owner only" }, { status: 403 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const b = parsed.data;
  const cents = Math.round(b.amountUsd * 100);
  const { data: row, error } = await sb.from("factory_invoices").insert({
    factory_id: b.factoryId, invoice_ref: b.invoiceRef, amount_cents: cents,
    submitted_at: `${b.invoiceDate}T12:00:00Z`,
    paid_at: b.paid ? `${b.invoiceDate}T12:00:00Z` : null,
    paid_amount_cents: b.paid ? cents : null,
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: prof.full_name ?? "owner",
    action: "factory_invoice.recorded", entity_table: "factory_invoices", entity_id: row.id,
    after: { ref: b.invoiceRef, amount_cents: cents },
  });
  return NextResponse.json({ ok: true });
}
