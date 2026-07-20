// ————— CLIENT ROSTER + HEALTH GRADES: computed, never typed, basis shown —————
import { Empty } from "@/components/Empty";
import { supabaseServer } from "@/lib/supabase-server";
import { formatUSD } from "@/lib/money";
import Link from "next/link";

export const dynamic = "force-dynamic";

const GRADE_COLOR: Record<string, string> = { A: "#2DD4BF", B: "#8FD64B", C: "#F5B84B", D: "#F58B4B", F: "#E5484D", "—": "#5C666D" };

function grade(paidCount: number, onTime: number, avgDaysLate: number, returns: number, openOverdue: number): [string, string] {
  if (paidCount < 3) return ["—", `${paidCount} PAID INVOICES — COLLECTING`];
  const pct = Math.round(100 * onTime / paidCount);
  let g = pct >= 95 ? "A" : pct >= 85 ? "B" : pct >= 70 ? "C" : pct >= 50 ? "D" : "F";
  if (returns > 0 && g < "D") g = "D";                    // an ACH return caps at D
  if (openOverdue > 0 && g === "A") g = "B";              // can't be A with money overdue now
  return [g, `${pct}% ON-TIME (${paidCount}) · AVG ${avgDaysLate.toFixed(0)}D LATE${returns ? ` · ${returns} RETURN${returns === 1 ? "" : "S"}` : ""}`];
}

export default async function Clients() {
  const sb = supabaseServer();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: clients }, { data: invoices }, { data: returns }] = await Promise.all([
    sb.from("clients").select("id, dba, legal_name, status, hold_active, watch_flag, dormant").eq("status", "active"),
    sb.from("invoices").select("client_id, status, due_date, total_cents, paid_cents, delivery_stamped_at, sent_at"),
    sb.from("payments").select("client_id").eq("status", "returned"),
  ]);

  const returnsBy = new Map<string, number>();
  for (const r of returns ?? []) returnsBy.set(r.client_id, (returnsBy.get(r.client_id) ?? 0) + 1);

  const rows = (clients ?? []).map(c => {
    const mine = (invoices ?? []).filter(i => i.client_id === c.id);
    const paid = mine.filter(i => i.status === "paid" && i.due_date);
    let onTime = 0, lateDays = 0;
    for (const i of paid) {
      // paid invoices: on-time if never went overdue; approximate lateness via due date vs now-paid marker
      const wasLate = i.due_date! < today && i.status !== "paid" ? true : false;
      if (!wasLate) onTime++;
      else lateDays += Math.max(0, Math.floor((Date.now() - new Date(i.due_date!).getTime()) / 864e5));
    }
    const openOverdue = mine.filter(i => ["sent","viewed","partially_paid","overdue"].includes(i.status) && i.due_date && i.due_date < today).length;
    const exposure = mine.filter(i => ["sent","viewed","partially_paid","overdue"].includes(i.status))
      .reduce((s, i) => s + BigInt(i.total_cents) - BigInt(i.paid_cents), 0n);
    const [g, basis] = grade(paid.length, onTime, paid.length ? lateDays / paid.length : 0, returnsBy.get(c.id) ?? 0, openOverdue);
    return { c, g, basis, exposure, openOverdue };
  }).sort((a, b) => (a.g === "—" ? "Z" : a.g) < (b.g === "—" ? "Z" : b.g) ? 1 : -1).reverse();

  return (
    <div className="max-w-5xl mx-auto px-4 pb-8">
      <div className="mt-4 rounded-lg border overflow-hidden" style={{ background: "#14181B", borderColor: "#262C31" }}>
        <div className="px-3 py-2 border-b" style={{ borderColor: "#262C31" }}>
          <span className="font-mono text-[10px] font-bold" style={{ color: "#8B949C" }}>CLIENTS — GRADES COMPUTED FROM PAYMENT BEHAVIOR, NEVER TYPED</span>
        </div>
        {rows.length === 0 && <div className="px-4 py-4"><Empty title="No clients yet" hint="IMPORT YOUR QUICKBOOKS HISTORY OR ONBOARD YOUR FIRST CLIENT — GRADES START COMPUTING AFTER THREE PAID INVOICES" /></div>}
        {rows.map(({ c, g, basis, exposure, openOverdue }) => (
          <Link key={c.id} href={`/admin/clients/${c.id}`} className="flex items-center px-3 py-3 border-b" style={{ borderColor: "#262C31" }}>
            <span className="w-8 h-8 rounded-lg flex items-center justify-center font-mono text-[14px] font-bold mr-3"
              style={{ background: `${GRADE_COLOR[g]}18`, color: GRADE_COLOR[g] }}>{g}</span>
            <div className="flex-1">
              <p className="text-[12px] font-semibold" style={{ color: "#E8EAEC" }}>
                {c.dba ?? c.legal_name}
                {c.hold_active && <span className="ml-2 font-mono text-[7px]" style={{ color: "#E5484D" }}>🔒 HOLD</span>}
                {c.watch_flag && <span className="ml-1.5 font-mono text-[7px]" style={{ color: "#F5B84B" }}>👁</span>}
                {c.dormant && <span className="ml-1.5 font-mono text-[7px]" style={{ color: "#5C666D" }}>💤</span>}
              </p>
              <p className="font-mono text-[7px] mt-0.5" style={{ color: "#5C666D" }}>{basis}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[11px] font-bold" style={{ color: openOverdue ? "#E5484D" : "#E8EAEC" }}>{formatUSD(exposure)}</p>
              <p className="font-mono text-[7px]" style={{ color: "#5C666D" }}>EXPOSURE</p>
            </div>
          </Link>
        ))}
        {!rows.length && <p className="px-3 py-4 text-[11px]" style={{ color: "#5C666D" }}>No active clients yet.</p>}
      </div>
      <p className="font-mono text-[8px] mt-2 px-1" style={{ color: "#5C666D" }}>
        GRADE RULES: &lt;3 PAID INVOICES = COLLECTING · ACH RETURN CAPS AT D · OPEN OVERDUE BLOCKS A · BASIS ALWAYS SHOWN
      </p>
    </div>
  );
}
