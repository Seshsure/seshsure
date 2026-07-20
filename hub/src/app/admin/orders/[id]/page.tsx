// ————— THE APPROVAL SCREEN: margin math + routing choice, before Tap 1 —————
import { supabaseServer } from "@/lib/supabase-server";
import { formatUSD, formatPerCone, conesToCents } from "@/lib/money";
import { ApprovePanel } from "@/components/ApprovePanel";

export const dynamic = "force-dynamic";

export default async function OrderApproval({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data: order } = await sb.from("orders")
    .select("*, order_items(quantity, price_per_cone_microcents, products(id, sku, description, is_flagship)), clients(dba, legal_name, deposit_pct, credit_ceiling_cents)")
    .eq("id", params.id).single();
  if (!order) return <p className="p-8 text-sm text-neutral-400">Order not found.</p>;

  const client = order.clients as unknown as { dba: string|null; legal_name: string|null; deposit_pct: number; credit_ceiling_cents: number|null };
  type Item = { quantity: number; price_per_cone_microcents: number; products: { id: string; sku: string; description: string; is_flagship: boolean } };
  const items = (order.order_items ?? []) as unknown as Item[];
  const isFlagship = items.some(i => i.products.is_flagship);
  const total = items.reduce((s, i) => s + conesToCents(BigInt(i.quantity), BigInt(i.price_per_cone_microcents)), 0n);

  const productId = items[0]?.products.id;
  const { data: factories } = await sb.from("factories")
    .select("id, name, flagship_approved, board_eligible").eq("is_active", true);
  const { data: scores } = await sb.from("factory_scorecards").select("*");
  const scoreMap = new Map((scores ?? []).map(s => [s.factory_id, s]));
  const factoryRows = [] as { id: string; name: string; rateMicro: bigint | null; onTime: string; load: number; eligible: boolean }[];
  for (const f of factories ?? []) {
    const { data: rate } = await sb.from("factory_rate_card")
      .select("cost_per_cone_microcents").eq("product_id", productId).eq("factory_id", f.id)
      .order("effective_at", { ascending: false }).limit(1).maybeSingle();
    const { count: load } = await sb.from("production_runs")
      .select("id", { count: "exact", head: true }).eq("factory_id", f.id).not("status", "in", '("closed")');
    const sc = scoreMap.get(f.id);
    factoryRows.push({
      id: f.id, name: f.name,
      rateMicro: rate ? BigInt(rate.cost_per_cone_microcents) : null,
      onTime: sc && sc.promised_runs >= 10 ? `${Math.round(100 * sc.on_time_runs / sc.promised_runs)}%` : `— (${sc?.promised_runs ?? 0} runs)`,
      load: load ?? 0,
      eligible: isFlagship ? f.flagship_approved : true,
    });
  }

  return (
    <div className="max-w-5xl mx-auto px-4 pb-8">
      <div className="mt-4 rounded-lg border overflow-hidden" style={{ background: "#FFFFFF", borderColor: "#E7DFCE" }}>
        <div className="px-3 py-2.5 border-b" style={{ borderColor: "#E7DFCE" }}>
          <p className="text-[13px] font-bold" style={{ color: "#181818" }}>
            {client.dba ?? client.legal_name} · PO {order.po_number}
            {isFlagship && <span className="ml-2 font-mono text-[8px] px-1.5 py-0.5 rounded" style={{ background: "#0D948822", color: "#0D9488" }}>FLAGSHIP</span>}
          </p>
        </div>
        {items.map((it, i) => (
          <div key={i} className="flex px-3 py-2.5 border-b" style={{ borderColor: "#E7DFCE" }}>
            <div className="flex-1">
              <p className="text-[12px]" style={{ color: "#181818" }}>{it.products.description}</p>
              <p className="font-mono text-[8px]" style={{ color: "#9B9484" }}>{Number(it.quantity).toLocaleString()} CONES @ {formatPerCone(BigInt(it.price_per_cone_microcents))}/CONE</p>
            </div>
            <span className="font-mono text-[12px] font-bold" style={{ color: "#181818" }}>
              {formatUSD(conesToCents(BigInt(it.quantity), BigInt(it.price_per_cone_microcents)))}
            </span>
          </div>
        ))}
        <div className="flex justify-between px-3 py-2.5" style={{ background: "#FAF5EA" }}>
          <span className="text-[12px] font-bold" style={{ color: "#181818" }}>Order total</span>
          <span className="font-mono text-[14px] font-bold" style={{ color: "#0D9488" }}>{formatUSD(total)}</span>
        </div>
      </div>

      <ApprovePanel
        orderId={order.id}
        defaultDeposit={order.deposit_pct ?? client.deposit_pct ?? 50}
        isFlagship={isFlagship}
        factories={factoryRows.map(f => ({
          ...f, rateMicro: f.rateMicro?.toString() ?? null,
        }))}
      />
    </div>
  );
}
