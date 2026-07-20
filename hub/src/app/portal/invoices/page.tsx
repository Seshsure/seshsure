import { supabaseServer } from "@/lib/supabase-server";
import { formatUSD } from "@/lib/money";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  paid: "#0D9488", overdue: "#D62839", partially_paid: "#B07A1F",
  sent: "#3E3A30", viewed: "#3E3A30",
};

export default async function Invoices() {
  const sb = supabaseServer();
  const { data: invoices } = await sb.from("invoices")
    .select("id, invoice_number, kind, status, total_cents, paid_cents, due_date, sent_at")
    .neq("status", "draft").order("sent_at", { ascending: false });

  return (
    <div className="max-w-3xl mx-auto px-4 py-5">
      <h1 className="font-bold text-[16px] mb-3" style={{ color: "#181818" }}>Invoices</h1>
      <div className="rounded-xl border overflow-hidden" style={{ background: "#fff", borderColor: "#E7DFCE" }}>
        {(invoices ?? []).map(inv => {
          const rem = BigInt(inv.total_cents) - BigInt(inv.paid_cents);
          return (
            <Link key={inv.id} href={`/portal/invoices/${inv.id}`}
              className="flex items-center px-4 py-3 border-b" style={{ borderColor: "#E7DFCE" }}>
              <div className="flex-1">
                <p className="font-mono text-[13px] font-bold" style={{ color: "#181818" }}>{inv.invoice_number}</p>
                <p className="font-mono text-[10px] mt-0.5" style={{ color: "#3E3A30" }}>
                  {inv.kind.toUpperCase()}{inv.due_date ? ` · DUE ${inv.due_date}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[14px] font-bold" style={{ color: "#181818" }}>{formatUSD(rem > 0n ? rem : BigInt(inv.total_cents))}</p>
                <p className="font-mono text-[10px] font-bold" style={{ color: STATUS_COLOR[inv.status] ?? "#3E3A30" }}>
                  {inv.status.replace("_", " ").toUpperCase()}
                </p>
              </div>
            </Link>
          );
        })}
        {!invoices?.length && <p className="px-4 py-6 text-[13px]" style={{ color: "#3E3A30" }}>No invoices yet.</p>}
      </div>
    </div>
  );
}
