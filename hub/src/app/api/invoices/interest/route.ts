// ————— DECLARE DEFAULT / RESTORE GRACE — owner only, audited —————
// Interest never starts on its own. Rob declares true default per invoice;
// this endpoint is the only door, and every use is logged with before/after.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({
  invoiceId: z.string().uuid(),
  action: z.enum(["declare_default", "restore_grace"]),
});

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (prof?.role !== "owner") return NextResponse.json({ error: "owner only" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { invoiceId, action } = parsed.data;

  const { data: inv } = await sb.from("invoices")
    .select("id, invoice_number, interest_frozen, status").eq("id", invoiceId).single();
  if (!inv) return NextResponse.json({ error: "not found" }, { status: 404 });

  const freeze = action === "restore_grace";
  await sb.from("invoices").update({ interest_frozen: freeze }).eq("id", invoiceId);
  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: prof.full_name ?? "owner",
    action: `invoice.${action}`, entity_table: "invoices", entity_id: invoiceId,
    before: { interest_frozen: inv.interest_frozen }, after: { interest_frozen: freeze },
  });
  return NextResponse.json({ ok: true, interestRunning: !freeze });
}
