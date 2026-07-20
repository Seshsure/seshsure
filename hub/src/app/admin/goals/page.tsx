// ————— GOALS: the exit math, live —————
// 10M units/month · $10M revenue run-rate · blended margin vs 2.5¢ · concentration
import { supabaseServer } from "@/lib/supabase-server";
import { formatUSD } from "@/lib/money";

export const dynamic = "force-dynamic";

const UNITS_GOAL = 10_000_000;          // per month
const REVENUE_GOAL_CENTS = 1_000_000_000n; // $10M annual
const MARGIN_TARGET_MICRO = 25_000;     // 2.5¢/cone blended

export default async function Goals() {
  const sb = supabaseServer();
  const monthStart = new Date(); monthStart.setDate(1);
  const yearAgo = new Date(Date.now() - 365 * 864e5).toISOString();
  const d90 = new Date(Date.now() - 90 * 864e5).toISOString();

  const [{ data: monthOrders }, { data: yearInvoices }, { data: monthInvoices }, { data: monthCollected }, { data: recentItems }, { data: runs90 }] = await Promise.all([
    sb.from("orders").select("order_items(quantity)").gte("created_at", monthStart.toISOString()).not("status", "in", '("draft","expired","cancelled")'),
    sb.from("invoices").select("total_cents").gte("created_at", yearAgo).in("status", ["sent","viewed","partially_paid","paid","overdue"]),
    sb.from("invoices").select("total_cents, factory_cost_cents").gte("created_at", monthStart.toISOString()).in("status", ["sent","viewed","partially_paid","paid","overdue"]),
    sb.from("payments").select("amount_cents").eq("status", "cleared").gte("cleared_at", monthStart.toISOString()),
    sb.from("order_items").select("quantity, price_per_cone_microcents, product_id, orders!inner(created_at, status)").gte("orders.created_at", d90),
    sb.from("production_runs").select("factory_id, run_orders(orders(order_items(quantity)))").gte("created_at", d90),
  ]);

  // units this month
  type OI = { order_items: { quantity: number }[] };
  const unitsThisMonth = ((monthOrders ?? []) as unknown as OI[])
    .flatMap(o => o.order_items ?? []).reduce((s, i) => s + Number(i.quantity), 0);
  const unitsPct = Math.min(100, Math.round(100 * unitsThisMonth / UNITS_GOAL));

  // ————— INCOME — the goal (invoiced + collected) —————
  const incomeMonth = (monthInvoices ?? []).reduce((s2, i) => s2 + BigInt(i.total_cents), 0n);
  const withCost = (monthInvoices ?? []).filter(i => i.factory_cost_cents !== null);
  const theirsMonth = withCost.reduce((s2, i) => s2 + BigInt(i.factory_cost_cents), 0n);
  const oursMonth = withCost.reduce((s2, i) => s2 + BigInt(i.total_cents) - BigInt(i.factory_cost_cents), 0n);
  const splitCoverage = (monthInvoices ?? []).length ? Math.round(100 * withCost.length / (monthInvoices ?? []).length) : 0;
  const collectedMonth = (monthCollected ?? []).reduce((s2, p) => s2 + BigInt(p.amount_cents), 0n);
  const MONTH_INCOME_GOAL = 83_333_333n; // $10M/yr ÷ 12 in cents
  const incomePct = Math.min(100, Number((incomeMonth * 100n) / MONTH_INCOME_GOAL));

  // revenue run-rate (trailing 12mo invoiced)
  const revenue12 = (yearInvoices ?? []).reduce((s, i) => s + BigInt(i.total_cents), 0n);
  const revPct = Math.min(100, Number((revenue12 * 100n) / REVENUE_GOAL_CENTS));

  // blended margin vs 2.5¢: (price − landed) volume-weighted, trailing 90d
  type Item = { quantity: number; price_per_cone_microcents: string; product_id: string };
  let volume = 0n, marginMicroSum = 0n, costMissing = false;
  const rateCache = new Map<string, bigint | null>();
  for (const it of (recentItems ?? []) as unknown as Item[]) {
    let landed = rateCache.get(it.product_id);
    if (landed === undefined) {
      const { data: rate } = await sb.from("factory_rate_card")
        .select("cost_per_cone_microcents, freight_per_cone_microcents, duty_per_cone_microcents")
        .eq("product_id", it.product_id).order("effective_at", { ascending: false }).limit(1).maybeSingle();
      landed = rate ? BigInt(rate.cost_per_cone_microcents) + BigInt(rate.freight_per_cone_microcents ?? 0) + BigInt(rate.duty_per_cone_microcents ?? 0) : null;
      rateCache.set(it.product_id, landed);
    }
    if (landed === null) { costMissing = true; continue; }
    const q = BigInt(it.quantity);
    volume += q;
    marginMicroSum += q * (BigInt(it.price_per_cone_microcents) - landed);
  }
  const blendedMicro = volume > 0n ? Number(marginMicroSum / volume) : null;

  // concentration (top factory, trailing 90d)
  const byFactory = new Map<string, number>();
  let total90 = 0;
  for (const r of runs90 ?? []) {
    type RO = { orders: { order_items: { quantity: number }[] } };
    const u = ((r.run_orders ?? []) as unknown as RO[]).flatMap(x => x.orders?.order_items ?? []).reduce((s, i) => s + Number(i.quantity), 0);
    byFactory.set(r.factory_id, (byFactory.get(r.factory_id) ?? 0) + u);
    total90 += u;
  }
  const topShare = total90 ? Math.round(100 * Math.max(...byFactory.values()) / total90) : null;

  const Bar = ({ pct, color }: { pct: number; color: string }) => (
    <div className="h-2 rounded-full mt-2 overflow-hidden" style={{ background: "#FAF5EA" }}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 pb-8">
      <h1 className="text-[15px] font-bold mt-4" style={{ color: "#181818" }}>Income goals — live</h1>

      <div className="mt-3 rounded-lg punch-sm p-4" style={{ background: "#FFFFFF" }}>
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[11px] font-bold" style={{ color: "#3E3A30" }}>INCOME THIS MONTH (INVOICED)</span>
          <span className="font-mono text-[16px] font-bold" style={{ color: "#181818" }}>
            {formatUSD(incomeMonth)} <span className="text-[11px]" style={{ color: "#5C574A" }}>/ {formatUSD(MONTH_INCOME_GOAL)} MO PACE</span>
          </span>
        </div>
        <Bar pct={incomePct} color="#0D9488" />
        <div className="flex items-baseline justify-between mt-3">
          <span className="font-mono text-[11px] font-bold" style={{ color: "#3E3A30" }}>COLLECTED THIS MONTH (CLEARED CASH)</span>
          <span className="font-mono text-[16px] font-bold" style={{ color: collectedMonth > 0n ? "#0D9488" : "#5C574A" }}>{formatUSD(collectedMonth)}</span>
        </div>
        <div className="flex items-baseline justify-between mt-3">
          <span className="font-mono text-[11px] font-bold" style={{ color: "#3E3A30" }}>OF WHICH — FACTORY / OURS</span>
          <span className="font-mono text-[13px] font-bold" style={{ color: "#181818" }}>
            {withCost.length ? <>{formatUSD(theirsMonth)} <span style={{ color: "#5C574A" }}>THEIRS</span> · <span style={{ color: "#0D9488" }}>{formatUSD(oursMonth)} OURS</span></> : <span style={{ color: "#C77800" }}>SET FACTORY COSTS ON INVOICES</span>}
            {withCost.length > 0 && splitCoverage < 100 && <span className="text-[10px]" style={{ color: "#C77800" }}> ({splitCoverage}% TAGGED)</span>}
          </span>
        </div>
        <p className="font-mono text-[10px] mt-2" style={{ color: "#5C574A" }}>INVOICED IS THE SCOREBOARD · COLLECTED IS THE TRUTH · THE GAP IS THE COLLECTIONS JOB</p>
      </div>

      <div className="mt-3 rounded-lg border p-4" style={{ background: "#FFFFFF", borderColor: "#E7DFCE" }}>
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[11px] font-bold" style={{ color: "#3E3A30" }}>UNITS THIS MONTH</span>
          <span className="font-mono text-[15px] font-bold" style={{ color: "#181818" }}>
            {unitsThisMonth.toLocaleString()} <span className="text-[11px]" style={{ color: "#5C574A" }}>/ {UNITS_GOAL.toLocaleString()}</span>
          </span>
        </div>
        <Bar pct={unitsPct} color="#0D9488" />
      </div>

      <div className="mt-3 rounded-lg border p-4" style={{ background: "#FFFFFF", borderColor: "#E7DFCE" }}>
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[11px] font-bold" style={{ color: "#3E3A30" }}>TRAILING-12MO INVOICED</span>
          <span className="font-mono text-[15px] font-bold" style={{ color: "#181818" }}>
            {formatUSD(revenue12)} <span className="text-[11px]" style={{ color: "#5C574A" }}>/ $10M</span>
          </span>
        </div>
        <Bar pct={revPct} color="#3B5BDB" />
      </div>

      <div className="mt-3 rounded-lg border p-4" style={{ background: "#FFFFFF", borderColor: blendedMicro !== null && blendedMicro < MARGIN_TARGET_MICRO ? "#E6394655" : "#E7DFCE" }}>
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[11px] font-bold" style={{ color: "#3E3A30" }}>GUARDRAIL — BLENDED MARGIN (90D)</span>
          <span className="font-mono text-[15px] font-bold" style={{ color: blendedMicro === null ? "#5C574A" : blendedMicro < MARGIN_TARGET_MICRO ? "#E63946" : "#0D9488" }}>
            {blendedMicro === null ? "—" : `${(blendedMicro / 10000).toFixed(2)}¢`}
            <span className="text-[11px]" style={{ color: "#5C574A" }}> / 2.50¢ TARGET</span>
          </span>
        </div>
        {blendedMicro !== null && <Bar pct={Math.min(100, Math.round(100 * blendedMicro / MARGIN_TARGET_MICRO))} color={blendedMicro < MARGIN_TARGET_MICRO ? "#E63946" : "#0D9488"} />}
        {costMissing && <p className="font-mono text-[10px] mt-2" style={{ color: "#C77800" }}>⚠ SOME PRODUCTS LACK COST BASIS — MARGIN UNDERSTATED UNTIL RATE CARD COMPLETE</p>}
      </div>

      <div className="mt-3 rounded-lg border p-4" style={{ background: "#FFFFFF", borderColor: topShare !== null && topShare >= 80 ? "#E6394655" : "#E7DFCE" }}>
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[11px] font-bold" style={{ color: "#3E3A30" }}>TOP-FACTORY CONCENTRATION (90D)</span>
          <span className="font-mono text-[15px] font-bold" style={{ color: topShare === null ? "#5C574A" : topShare >= 80 ? "#E63946" : "#0D9488" }}>
            {topShare === null ? "—" : `${topShare}%`}
          </span>
        </div>
        {topShare !== null && <Bar pct={topShare} color={topShare >= 80 ? "#E63946" : "#0D9488"} />}
        <p className="font-mono text-[10px] mt-2" style={{ color: "#5C574A" }}>BUYERS DISCOUNT SINGLE-SOURCE SUPPLY CHAINS — RUN BOARD IS THE FIX</p>
      </div>

      <p className="font-mono text-[10px] mt-3 px-1" style={{ color: "#5C574A" }}>
        GOALS ARE INCOME: MONTHLY INVOICED, CASH COLLECTED, RUN-RATE, UNITS. MARGIN AND CONCENTRATION RIDE BELOW AS GUARDRAILS — FLOORS, NOT TARGETS.
      </p>
    </div>
  );
}
