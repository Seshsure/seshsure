import { supabaseServer } from "@/lib/supabase-server";
import { formatUSD } from "@/lib/money";
import { PayPanel } from "@/components/PayPanel";

export const dynamic = "force-dynamic";

export default async function InvoiceDetail({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: inv } = await sb.from("invoices")
    .select("*, invoice_line_items(description, amount_cents)").eq("id", params.id).single();
  if (!inv) return <p className="p-8 text-sm" style={{ color: "#6E6A5E" }}>Invoice not found.</p>;

  // view evidence — every open logged
  await sb.from("invoice_views").insert({ invoice_id: inv.id, viewer_profile_id: user!.id });

  const remaining = BigInt(inv.total_cents) - BigInt(inv.paid_cents);
  const payable = !["paid", "void", "draft"].includes(inv.status) && remaining > 0n;

  return (
    <div className="max-w-3xl mx-auto px-4 py-5">
      <div className="rounded-xl border overflow-hidden" style={{ background: "#fff", borderColor: "#E7DFCE" }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "#E7DFCE" }}>
          <div>
            <p className="font-mono text-[13px] font-bold" style={{ color: "#181818" }}>{inv.invoice_number}</p>
            <p className="font-mono text-[8px]" style={{ color: "#6E6A5E" }}>{inv.kind.toUpperCase()}{inv.due_date ? ` · DUE ${inv.due_date}` : ""}</p>
          </div>
          <p className="font-mono text-[16px] font-bold" style={{ color: "#181818" }}>{formatUSD(remaining)}</p>
        </div>
        {(inv.invoice_line_items as { description: string; amount_cents: string }[] ?? []).map((l, i) => (
          <div key={i} className="flex justify-between px-4 py-2.5 border-b" style={{ borderColor: "#E7DFCE" }}>
            <span className="text-[11px]" style={{ color: "#181818" }}>{l.description}</span>
            <span className="font-mono text-[11px]" style={{ color: "#181818" }}>{formatUSD(BigInt(l.amount_cents))}</span>
          </div>
        ))}
      </div>
      <a href={`/api/invoices/${inv.id}/pdf`} target="_blank"
        className="block mt-3 py-2.5 rounded-lg border text-center font-mono text-[10px] font-bold"
        style={{ borderColor: "#E7DFCE", color: "#6E6A5E", background: "#fff" }}>
        ⬇ DOWNLOAD PDF
      </a>
      {payable && <PayPanel invoiceId={inv.id} remainingCents={remaining.toString()} />}
    </div>
  );
}
