// ————— FACTORY INVOICE SUBMISSION — RLS holds them to their own factory —————
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({
  factoryId: z.string().uuid(),
  invoiceRef: z.string().min(1).max(60),
  amountUsd: z.number().positive(),
  runId: z.string().uuid().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  storagePath: z.string().min(3).optional(),
});

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const b = parsed.data;
  const { error } = await sb.from("factory_invoices").insert({
    factory_id: b.factoryId, invoice_ref: b.invoiceRef, amount_cents: Math.round(b.amountUsd * 100),
    run_id: b.runId ?? null, due_date: b.dueDate ?? null, storage_path: b.storagePath ?? null,
  });
  if (error) return NextResponse.json({ error: "not permitted" }, { status: 403 });
  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: "factory", action: "factory.invoice_submitted",
    entity_table: "factory_invoices", after: { ref: b.invoiceRef, amount_usd: b.amountUsd },
  });
  return NextResponse.json({ ok: true });
}
