import { supabaseServer } from "@/lib/supabase-server";
import { formatUSD } from "@/lib/money";
import Link from "next/link";
import { Empty } from "@/components/Empty";

export const dynamic = "force-dynamic";

export default async function Command() {
  const sb = supabaseServer();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: invoices }, { data: ready }, { data: tasks }, { data: submitted }, { data: clearedPays }, { data: allocs }] = await Promise.all([
    sb.from("invoices").select("total_cents, paid_cents, due_date").in("status", ["sent","viewed","partially_paid","overdue"]),
    sb.from("payments").select("id, amount_cents").eq("status", "cleared"),
    sb.from("payment_allocations").select("payment_id"),
    sb.from("payments").select("amount_cents").in("status", ["authorized","scheduled"]).or(`scheduled_for.is.null,scheduled_for.lte.${today}`),
    sb.from("tasks").select("id, title, due_on").is("completed_at", null).order("due_on").limit(10),
    sb.from("orders").select("id, po_number, clients(dba, legal_name)").eq("status", "submitted"),
  ]);
  const grossAr = (invoices ?? []).reduce((s, i) => s + BigInt(i.total_cents) - BigInt(i.paid_cents), 0n);
  const allocated = new Set((allocs ?? []).map(a => a.payment_id));
  const unappliedCash = (clearedPays ?? []).filter(p2 => !allocated.has(p2.id))
    .reduce((s, p2) => s + BigInt(p2.amount_cents), 0n);
  const ar = grossAr - unappliedCash;
  const overdue = (invoices ?? []).filter(i => i.due_date && i.due_date < today).length;
  const batchTotal = (ready ?? []).reduce((s, p) => s + BigInt(p.amount_cents), 0n);

  return (
    <div className="max-w-5xl mx-auto px-4 pb-10">
      <div className="flex items-end justify-between mt-6">
        <div>
          <p className="eyebrow" style={{ color: "#5C574A" }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="display text-[26px] mt-1" style={{ color: "var(--ink)" }}>Command</h1>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-4">
        {[
          ["AR OUT", formatUSD(ar), overdue ? "#E63946" : "#181818"],
          ...(unappliedCash > 0n ? [["UNAPPLIED CASH", formatUSD(unappliedCash), "#0D9488"] as [string, string, string]] : []),
          ["OVERDUE", String(overdue), overdue ? "#E63946" : "#0D9488"],
          ["BATCH READY", formatUSD(batchTotal), batchTotal > 0n ? "#0D9488" : "#5C574A"],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-lg p-3 punch-sm" style={{ background: "#FFFFFF" }}>
            <p className="font-mono text-[9px] font-bold" style={{ color: "#5C574A" }}>{label}</p>
            <p className="font-mono text-[15px] font-bold mt-1" style={{ color: color as string }}>{value}</p>
          </div>
        ))}
      </div>

      {(submitted?.length ?? 0) > 0 && (
        <div className="mt-4 rounded-lg border overflow-hidden" style={{ background: "#FFFFFF", borderColor: "#0D948844" }}>
          <div className="px-3 py-2 border-b" style={{ borderColor: "#E7DFCE" }}>
            <span className="font-mono text-[12px] font-bold" style={{ color: "#0D9488" }}>ORDERS AWAITING YOUR APPROVAL</span>
          </div>
          {(submitted ?? []).length === 0 && <div className="px-4 py-4"><Empty title="No orders waiting on you" hint="WHEN A CLIENT SUBMITS AN ORDER IT LANDS HERE FOR YOUR MARGIN CHECK AND ROUTING" /></div>}
        {(submitted ?? []).map(o => (
            <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex px-3 py-2.5 border-b" style={{ borderColor: "#E7DFCE" }}>
              <span className="flex-1 text-[14px]" style={{ color: "#181818" }}>
                {((o.clients as unknown as { dba: string|null; legal_name: string })?.dba) ?? (o.clients as unknown as { legal_name: string })?.legal_name} · PO {o.po_number}
              </span>
              <span className="font-mono text-[11px]" style={{ color: "#0D9488" }}>REVIEW →</span>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-lg border overflow-hidden" style={{ background: "#FFFFFF", borderColor: "#E7DFCE" }}>
        <div className="px-3 py-2 border-b" style={{ borderColor: "#E7DFCE" }}>
          <span className="font-mono text-[12px] font-bold" style={{ color: "#3E3A30" }}>YOUR QUEUE</span>
        </div>
        {(tasks ?? []).length === 0 && <div className="px-4 py-4"><Empty title="Queue clear" hint="THE 23 WORKERS FILE TASKS HERE — RETURNS, FOLLOW-UPS, DEADLINES, EXCEPTIONS — AS THE BUSINESS BREATHES" /></div>}
        {(tasks ?? []).map(t => (
          <div key={t.id} className="px-3 py-2.5 border-b" style={{ borderColor: "#E7DFCE" }}>
            <p className="text-[11.5px]" style={{ color: "#181818" }}>{t.title}</p>
            <p className="font-mono text-[10px] mt-0.5" style={{ color: t.due_on < today ? "#E63946" : "#5C574A" }}>DUE {t.due_on}</p>
          </div>
        ))}
        {!tasks?.length && <p className="px-3 py-4 text-[13px]" style={{ color: "#5C574A" }}>Queue clear ✓</p>}
      </div>
    </div>
  );
}
