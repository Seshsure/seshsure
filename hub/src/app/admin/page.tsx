import { supabaseServer } from "@/lib/supabase-server";
import { formatUSD } from "@/lib/money";
import Link from "next/link";
import { Empty } from "@/components/Empty";

export const dynamic = "force-dynamic";

export default async function Command() {
  const sb = supabaseServer();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: invoices }, { data: ready }, { data: tasks }, { data: submitted }] = await Promise.all([
    sb.from("invoices").select("total_cents, paid_cents, due_date").in("status", ["sent","viewed","partially_paid","overdue"]),
    sb.from("payments").select("amount_cents").in("status", ["authorized","scheduled"]).or(`scheduled_for.is.null,scheduled_for.lte.${today}`),
    sb.from("tasks").select("id, title, due_on").is("completed_at", null).order("due_on").limit(10),
    sb.from("orders").select("id, po_number, clients(dba, legal_name)").eq("status", "submitted"),
  ]);
  const ar = (invoices ?? []).reduce((s, i) => s + BigInt(i.total_cents) - BigInt(i.paid_cents), 0n);
  const overdue = (invoices ?? []).filter(i => i.due_date && i.due_date < today).length;
  const batchTotal = (ready ?? []).reduce((s, p) => s + BigInt(p.amount_cents), 0n);

  return (
    <div className="max-w-5xl mx-auto px-4 pb-10">
      <div className="flex items-end justify-between mt-6">
        <div>
          <p className="eyebrow" style={{ color: "#5C666D" }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="text-[22px] font-bold mt-1" style={{ color: "#E8EAEC" }}>Command</h1>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-4">
        {[
          ["AR OUT", formatUSD(ar), overdue ? "#E5484D" : "#E8EAEC"],
          ["OVERDUE", String(overdue), overdue ? "#E5484D" : "#2DD4BF"],
          ["BATCH READY", formatUSD(batchTotal), batchTotal > 0n ? "#2DD4BF" : "#5C666D"],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-lg border p-3" style={{ background: "#14181B", borderColor: "#262C31" }}>
            <p className="font-mono text-[7px] font-bold" style={{ color: "#5C666D" }}>{label}</p>
            <p className="font-mono text-[13px] font-bold mt-1" style={{ color: color as string }}>{value}</p>
          </div>
        ))}
      </div>

      {(submitted?.length ?? 0) > 0 && (
        <div className="mt-4 rounded-lg border overflow-hidden" style={{ background: "#14181B", borderColor: "#2DD4BF44" }}>
          <div className="px-3 py-2 border-b" style={{ borderColor: "#262C31" }}>
            <span className="font-mono text-[10px] font-bold" style={{ color: "#2DD4BF" }}>ORDERS AWAITING YOUR APPROVAL</span>
          </div>
          {(submitted ?? []).length === 0 && <div className="px-4 py-4"><Empty title="No orders waiting on you" hint="WHEN A CLIENT SUBMITS AN ORDER IT LANDS HERE FOR YOUR MARGIN CHECK AND ROUTING" /></div>}
        {(submitted ?? []).map(o => (
            <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex px-3 py-2.5 border-b" style={{ borderColor: "#262C31" }}>
              <span className="flex-1 text-[12px]" style={{ color: "#E8EAEC" }}>
                {((o.clients as unknown as { dba: string|null; legal_name: string })?.dba) ?? (o.clients as unknown as { legal_name: string })?.legal_name} · PO {o.po_number}
              </span>
              <span className="font-mono text-[9px]" style={{ color: "#2DD4BF" }}>REVIEW →</span>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-lg border overflow-hidden" style={{ background: "#14181B", borderColor: "#262C31" }}>
        <div className="px-3 py-2 border-b" style={{ borderColor: "#262C31" }}>
          <span className="font-mono text-[10px] font-bold" style={{ color: "#8B949C" }}>YOUR QUEUE</span>
        </div>
        {(tasks ?? []).length === 0 && <div className="px-4 py-4"><Empty title="Queue clear" hint="THE 23 WORKERS FILE TASKS HERE — RETURNS, FOLLOW-UPS, DEADLINES, EXCEPTIONS — AS THE BUSINESS BREATHES" /></div>}
        {(tasks ?? []).map(t => (
          <div key={t.id} className="px-3 py-2.5 border-b" style={{ borderColor: "#262C31" }}>
            <p className="text-[11.5px]" style={{ color: "#E8EAEC" }}>{t.title}</p>
            <p className="font-mono text-[8px] mt-0.5" style={{ color: t.due_on < today ? "#E5484D" : "#5C666D" }}>DUE {t.due_on}</p>
          </div>
        ))}
        {!tasks?.length && <p className="px-3 py-4 text-[11px]" style={{ color: "#5C666D" }}>Queue clear ✓</p>}
      </div>
    </div>
  );
}
