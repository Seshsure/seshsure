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

  const [{ data: monthOrders }, { data: yearInvoices }, { data: recentItems }, { data: runs90 }] = await Promise.all([
    sb.from("orders").select("order_items(quantity)").gte("created_at", monthStart.toISOString()).not("status", "in", '("draft","expired","cancelled")'),
    sb.from("invoices").select("total_cents").gte("created_at", yearAgo).in("status", ["sent","viewed","partially_paid","paid","overdue"]),
    sb.from("order_items").select("quantity, price_per_cone_microcents, product_id, orders!inner(created_at, status)").gte("orders.created_at", d90),
    sb.from("production_runs").select("factory_id, run_orders(orders(order_items(quantity)))").gte("created_at", d90),
  ]);

  // units this month
  type OI = { order_items: { quantity: number }[] };
  const unitsThisMonth = ((monthOrders ?? []) as unknown as OI[])
    .flatMap(o => o.order_items ?? []).reduce((s, i) => s + Number(i.quantity), 0);
  const unitsPct = Math.min(100, Math.round(100 * unitsThisMonth / UNITS_GOAL));

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
    <div className="h-2 rounded-full mt-2 overflow-hidden" style={{ background: "#0C0F11" }}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 pb-8">
      <h1 className="text-[13px] font-bold mt-4" style={{ color: "#E8EAEC" }}>The exit math — live</h1>

      <div className="mt-3 rounded-lg border p-4" style={{ background: "#14181B", borderColor: "#262C31" }}>
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[9px] font-bold" style={{ color: "#8B949C" }}>UNITS THIS MONTH</span>
          <span className="font-mono text-[15px] font-bold" style={{ color: "#E8EAEC" }}>
            {unitsThisMonth.toLocaleString()} <span className="text-[9px]" style={{ color: "#5C666D" }}>/ {UNITS_GOAL.toLocaleString()}</span>
          </span>
        </div>
        <Bar pct={unitsPct} color="#2DD4BF" />
      </div>

      <div className="mt-3 rounded-lg border p-4" style={{ background: "#14181B", borderColor: "#262C31" }}>
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[9px] font-bold" style={{ color: "#8B949C" }}>TRAILING-12MO INVOICED</span>
          <span className="font-mono text-[15px] font-bold" style={{ color: "#E8EAEC" }}>
            {formatUSD(revenue12)} <span className="text-[9px]" style={{ color: "#5C666D" }}>/ $10M</span>
          </span>
        </div>
        <Bar pct={revPct} color="#4B9BFF" />
      </div>

      <div className="mt-3 rounded-lg border p-4" style={{ background: "#14181B", borderColor: blendedMicro !== null && blendedMicro < MARGIN_TARGET_MICRO ? "#E5484D55" : "#262C31" }}>
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[9px] font-bold" style={{ color: "#8B949C" }}>BLENDED MARGIN (90D, VOLUME-WEIGHTED)</span>
          <span className="font-mono text-[15px] font-bold" style={{ color: blendedMicro === null ? "#5C666D" : blendedMicro < MARGIN_TARGET_MICRO ? "#E5484D" : "#2DD4BF" }}>
            {blendedMicro === null ? "—" : `${(blendedMicro / 10000).toFixed(2)}¢`}
            <span className="text-[9px]" style={{ color: "#5C666D" }}> / 2.50¢ TARGET</span>
          </span>
        </div>
        {blendedMicro !== null && <Bar pct={Math.min(100, Math.round(100 * blendedMicro / MARGIN_TARGET_MICRO))} color={blendedMicro < MARGIN_TARGET_MICRO ? "#E5484D" : "#2DD4BF"} />}
        {costMissing && <p className="font-mono text-[8px] mt-2" style={{ color: "#F5B84B" }}>⚠ SOME PRODUCTS LACK COST BASIS — MARGIN UNDERSTATED UNTIL RATE CARD COMPLETE</p>}
      </div>

      <div className="mt-3 rounded-lg border p-4" style={{ background: "#14181B", borderColor: topShare !== null && topShare >= 80 ? "#E5484D55" : "#262C31" }}>
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[9px] font-bold" style={{ color: "#8B949C" }}>TOP-FACTORY CONCENTRATION (90D)</span>
          <span className="font-mono text-[15px] font-bold" style={{ color: topShare === null ? "#5C666D" : topShare >= 80 ? "#E5484D" : "#2DD4BF" }}>
            {topShare === null ? "—" : `${topShare}%`}
          </span>
        </div>
        {topShare !== null && <Bar pct={topShare} color={topShare >= 80 ? "#E5484D" : "#2DD4BF"} />}
        <p className="font-mono text-[8px] mt-2" style={{ color: "#5C666D" }}>BUYERS DISCOUNT SINGLE-SOURCE SUPPLY CHAINS — RUN BOARD IS THE FIX</p>
      </div>

      <p className="font-mono text-[8px] mt-3 px-1" style={{ color: "#5C666D" }}>
        THESE FOUR NUMBERS ARE THE ACQUISITION STORY: VOLUME, REVENUE, MARGIN, RESILIENCE.
      </p>
    </div>
  );
}
