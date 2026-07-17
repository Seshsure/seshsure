// Statement PDF — client self-serve or owner (any client, ?forCourt=1 adds the records recital)
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { renderStatementPdf, StatementRow } from "@/lib/pdf/statement-pdf";

export async function GET(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("client_id, role").eq("id", user.id).single();

  const url = new URL(req.url);
  const requested = url.searchParams.get("clientId");
  const forCourt = url.searchParams.get("forCourt") === "1" && prof?.role === "owner";
  const clientId = prof?.role === "owner" ? (requested ?? prof.client_id) : prof?.client_id;
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });
  if (prof?.role !== "owner" && requested && requested !== prof?.client_id)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const [{ data: client }, { data: invoices }, { data: payments }] = await Promise.all([
    sb.from("clients").select("legal_name, dba").eq("id", clientId).single(),
    sb.from("invoices").select("id, invoice_number, kind, status, total_cents, sent_at, created_at").eq("client_id", clientId).not("status", "in", '("draft","void")'),
    sb.from("payments").select("id, method, amount_cents, cleared_at, status").eq("client_id", clientId).eq("status", "cleared"),
  ]);
  if (!client) return NextResponse.json({ error: "not found" }, { status: 404 });

  const rows: StatementRow[] = [];
  for (const i of invoices ?? []) rows.push({
    date: i.sent_at ?? i.created_at, ref: i.invoice_number,
    description: `Invoice (${i.kind})`, chargeCents: BigInt(i.total_cents), creditCents: null,
  });
  for (const p of payments ?? []) rows.push({
    date: p.cleared_at!, ref: p.id.slice(0, 8),
    description: `Payment (${p.method}) — cleared`, chargeCents: null, creditCents: BigInt(p.amount_cents),
  });
  rows.sort((a, b) => (a.date < b.date ? -1 : 1));

  const pdf = await renderStatementPdf({
    client: { name: client.legal_name, dba: client.dba },
    asOf: new Date().toISOString().slice(0, 10),
    rows, forCourt,
    entity: {
      name: "Vido Manufacturing and Distribution Corp d/b/a SeshSure",
      address: "10940 S. Parker Rd, Suite 788, Parker, CO 80134",
      email: "billing@seshsure.com",
    },
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="statement-${(client.dba ?? client.legal_name).replace(/\W+/g, "-")}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
