// Invoice PDF — RLS scopes access: the client sees their own, you see all
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { renderInvoicePdf } from "@/lib/pdf/invoice-pdf";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const { data: inv } = await sb.from("invoices")
    .select("*, invoice_line_items(description, amount_cents), clients(legal_name, dba), orders(order_number, po_number)")
    .eq("id", params.id).single();
  if (!inv) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: entity } = await sb.from("entities")
    .select("legal_name, address, checks_payable_to, remit_check_address").eq("is_default", true).single();
  const { data: addr } = await sb.from("client_addresses")
    .select("address").eq("client_id", inv.client_id).limit(1).maybeSingle();

  const client = inv.clients as unknown as { legal_name: string; dba: string | null };
  const order = inv.orders as unknown as { order_number: string | null; po_number: string | null } | null;
  const lines = (inv.invoice_line_items ?? []) as { description: string; amount_cents: string }[];

  const pdf = await renderInvoicePdf({
    invoiceNumber: inv.invoice_number,
    kind: inv.kind, status: inv.status,
    issuedOn: (inv.sent_at ?? inv.created_at).slice(0, 10),
    dueOn: inv.due_date, poNumber: order?.po_number ?? null, orderNumber: order?.order_number ?? null,
    billTo: { name: client.legal_name, dba: client.dba, address: addr?.address ?? null },
    lines: lines.map(l => ({ description: l.description, amountCents: BigInt(l.amount_cents) })),
    subtotalCents: BigInt(inv.subtotal_cents ?? inv.total_cents),
    interestCents: BigInt(inv.interest_cents ?? 0),
    totalCents: BigInt(inv.total_cents), paidCents: BigInt(inv.paid_cents),
    entity: {
      name: entity?.legal_name ?? "Vido Manufacturing and Distribution Corp d/b/a SeshSure",
      address: entity?.remit_check_address ?? "10940 S. Parker Rd, Suite 788, Parker, CO 80134",
      email: "billing@seshsure.com",
      checksPayableTo: entity?.checks_payable_to ?? "Vido Manufacturing and Distribution Corp",
      remitAddress: entity?.remit_check_address ?? "10940 S. Parker Rd, Suite 788, Parker, CO 80134",
    },
    portalUrl: `${process.env.HUB_URL ?? "https://hub.seshsure.com"}/portal/invoices/${inv.id}`,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${inv.invoice_number}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
