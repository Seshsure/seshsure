// Factory command: scorecards + concentration risk + onboarding states
import { supabaseServer } from "@/lib/supabase-server";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Factories() {
  const sb = supabaseServer();
  const [{ data: factories }, { data: scores }] = await Promise.all([
    sb.from("factories").select("id, name, country, payment_terms, flagship_approved, board_eligible, is_active"),
    sb.from("factory_scorecards").select("*"),
  ]);
  const scoreMap = new Map((scores ?? []).map(s => [s.factory_id, s]));

  const since = new Date(Date.now() - 90 * 864e5).toISOString();
  const { data: recent } = await sb.from("production_runs")
    .select("factory_id, created_at, run_orders(orders(order_items(quantity)))")
    .gte("created_at", since);
  const byFactory = new Map<string, number>();
  let totalUnits = 0;
  for (const r of recent ?? []) {
    type RO = { orders: { order_items: { quantity: number }[] } };
    const units = ((r.run_orders ?? []) as unknown as RO[])
      .flatMap(x => x.orders?.order_items ?? []).reduce((s, i) => s + Number(i.quantity), 0);
    byFactory.set(r.factory_id, (byFactory.get(r.factory_id) ?? 0) + units);
    totalUnits += units;
  }
  const top = [...byFactory.entries()].sort((a, b) => b[1] - a[1])[0];
  const concentration = top && totalUnits ? Math.round(100 * top[1] / totalUnits) : null;

  return (
    <div className="max-w-5xl mx-auto px-4 pb-8">
      {concentration !== null && (
        <div className="mt-4 p-3 rounded-lg border" style={{ background: "#FFFFFF", borderColor: concentration >= 80 ? "#E6394655" : "#E7DFCE" }}>
          <p className="text-[9px] font-semibold" style={{ color: "#514C41" }}>CONCENTRATION RISK — TRAILING 90 DAYS</p>
          <p className="font-mono text-[17px] font-bold" style={{ color: concentration >= 80 ? "#E63946" : "#181818" }}>
            {concentration}% <span className="text-[10px]" style={{ color: "#7A7365" }}>OF VOLUME ON TOP FACTORY</span>
          </p>
          {concentration >= 80 && <p className="font-mono text-[8px] mt-1" style={{ color: "#E63946" }}>DIVERSIFY VIA THE RUN BOARD — SECOND-SOURCE FILE RECOMMENDED</p>}
        </div>
      )}
      <div className="mt-4 rounded-lg border overflow-hidden" style={{ background: "#FFFFFF", borderColor: "#E7DFCE" }}>
        <div className="px-3 py-2 border-b" style={{ borderColor: "#E7DFCE" }}>
          <span className="text-[10px] font-mono font-bold" style={{ color: "#514C41" }}>FACTORIES — SCORES ARE COMPUTED, NEVER TYPED</span>
        </div>
        {(factories ?? []).map(f => {
          const sc = scoreMap.get(f.id);
          const onTime = sc && sc.promised_runs >= 10 ? `${Math.round(100 * sc.on_time_runs / sc.promised_runs)}% ON-TIME (${sc.promised_runs})` : `COLLECTING — ${sc?.promised_runs ?? 0} RUNS`;
          const defects = sc?.fault_disputes ?? 0;
          return (
            <Link key={f.id} href={`/admin/factories/${f.id}`} className="block px-3 py-3 border-b" style={{ borderColor: "#E7DFCE" }}>
              <div className="flex items-center justify-between">
                <p className="text-[12.5px] font-bold" style={{ color: "#181818" }}>
                  {f.name}
                  {f.flagship_approved && <span className="ml-2 font-mono text-[7px] px-1.5 py-0.5 rounded" style={{ background: "#0D948822", color: "#0D9488" }}>FLAGSHIP</span>}
                  {!f.board_eligible && <span className="ml-2 font-mono text-[7px] px-1.5 py-0.5 rounded" style={{ background: "#C7780022", color: "#C77800" }}>QUALIFYING</span>}
                </p>
                <span className="font-mono text-[8px]" style={{ color: "#7A7365" }}>{f.country ?? ""} · {f.payment_terms ?? "terms TBD"}</span>
              </div>
              <p className="font-mono text-[9px] mt-1" style={{ color: "#514C41" }}>
                {onTime} · {sc?.completed_runs ?? 0} RUNS COMPLETE · {defects} FAULT DISPUTE{defects === 1 ? "" : "S"}
                {sc?.units_delivered ? ` · ${Number(sc.units_delivered).toLocaleString()} UNITS` : ""}
              </p>
            </Link>
          );
        })}
      </div>
      <p className="font-mono text-[8px] mt-2 px-1" style={{ color: "#7A7365" }}>
        DISPLAY RULES: NO SCORE UNDER 10 RUNS · VOLUME BESIDE PERCENTAGE · ONLY ROB-RULED FACTORY-FAULT COUNTS
      </p>
    </div>
  );
}
