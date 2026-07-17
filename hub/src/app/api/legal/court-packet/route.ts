// COURT-READY EXPORT: the Douglas County packet, one tap
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({ clientId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (prof?.role !== "owner") return NextResponse.json({ error: "owner only" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const clientId = parsed.data.clientId;

  const [client, invoices, views, auths, reminders, signatures, payments, events] = await Promise.all([
    sb.from("clients").select("*").eq("id", clientId).single(),
    sb.from("invoices").select("*, invoice_line_items(*)").eq("client_id", clientId).neq("status", "draft"),
    sb.from("invoice_views").select("*, invoices!inner(client_id, invoice_number)").eq("invoices.client_id", clientId),
    sb.from("ach_authorizations").select("*").eq("client_id", clientId),
    sb.from("reminders").select("*, invoices!inner(client_id, invoice_number)").eq("invoices.client_id", clientId),
    sb.from("signatures").select("*, agreement_versions(doc_key, version)").eq("client_id", clientId),
    sb.from("payments").select("*").eq("client_id", clientId),
    sb.from("activity_log").select("*").eq("client_id", clientId).order("created_at"),
  ]);

  type Row = { date: string; ref: string; description: string; charge: string | null; credit: string | null };
  const rows: Row[] = [];
  for (const inv of invoices.data ?? []) {
    if (["void"].includes(inv.status)) continue;
    rows.push({ date: inv.sent_at ?? inv.created_at, ref: inv.invoice_number,
      description: `Invoice (${inv.kind})`, charge: inv.total_cents, credit: null });
  }
  for (const p of payments.data ?? []) {
    if (p.status === "cleared") rows.push({ date: p.cleared_at, ref: p.id.slice(0, 8),
      description: `Payment (${p.method}) — CLEARED`, charge: null, credit: p.amount_cents });
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : 1));
  let bal = 0n;
  const statement = rows.map(r => {
    bal += BigInt(r.charge ?? 0) - BigInt(r.credit ?? 0);
    return { ...r, balance: bal.toString() };
  });

  const packet = {
    generated_at: new Date().toISOString(),
    generated_by: prof.full_name,
    venue_note: "Douglas County County Court, Colorado",
    plaintiff: "Vido Manufacturing and Distribution Corp d/b/a SeshSure",
    defendant: client.data,
    statement_of_account: statement,
    open_balance_cents: bal.toString(),
    invoices: invoices.data,
    invoice_view_evidence: views.data,
    payment_authorizations: auths.data,
    reminder_history: reminders.data,
    signed_agreements: signatures.data,
    activity_timeline: events.data,
  };

  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: prof.full_name,
    action: "legal.court_packet_generated", entity_table: "clients", entity_id: clientId,
    after: { open_balance_cents: bal.toString() },
  });
  return NextResponse.json({ ok: true, packet });
}
