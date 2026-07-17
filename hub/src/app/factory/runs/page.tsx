import { supabaseServer } from "@/lib/supabase-server";
import { RunConfirm } from "@/components/RunConfirm";

export const dynamic = "force-dynamic";

export default async function Runs() {
  const sb = supabaseServer();
  const { data: runs } = await sb.from("production_runs")
    .select("id, run_number, status, promise_date, created_at, run_orders(orders(order_number, clients(dba, legal_name), order_items(quantity, products(description))))")
    .not("status", "in", '("closed")').order("created_at", { ascending: false });

  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      <h1 className="font-bold text-[16px] mb-1" style={{ color: "#15181A" }}>Production runs</h1>
      <p className="text-[10px] font-mono mb-3" style={{ color: "#6E756B" }}>CONFIRM WITHIN 48H · PROMISE-DATE CHANGES REQUIRE SESHSURE ACKNOWLEDGMENT</p>
      <div className="rounded-xl border overflow-hidden" style={{ background: "#fff", borderColor: "#E4E1DA" }}>
        {(runs ?? []).map(r => {
          type RO = { orders: { order_number: string; clients: { dba: string|null; legal_name: string|null }; order_items: { quantity: number; products: { description: string } }[] } };
          const ros = (r.run_orders ?? []) as unknown as RO[];
          const qty = ros.flatMap(x => x.orders?.order_items ?? []).reduce((s, i) => s + Number(i.quantity), 0);
          const desc = ros.flatMap(x => x.orders?.order_items ?? []).map(i => i.products?.description)[0] ?? "";
          const hrs = Math.floor((Date.now() - new Date(r.created_at).getTime()) / 36e5);
          return (
            <div key={r.id} className="px-4 py-3 border-b" style={{ borderColor: "#E4E1DA" }}>
              <div className="flex items-center justify-between">
                <p className="font-mono text-[11px] font-bold" style={{ color: "#15181A" }}>{r.run_number}</p>
                <span className="font-mono text-[8px] font-bold px-2 py-1 rounded" style={{
                  color: r.status === "placed" && hrs > 48 ? "#B4231F" : "#0D9488", background: "#0D948810" }}>
                  {r.status === "placed" ? `AWAITING CONFIRMATION · ${hrs}H` : String(r.status).replace(/_/g," ").toUpperCase()}
                </span>
              </div>
              <p className="text-[10px] mt-1" style={{ color: "#6E756B" }}>
                {qty.toLocaleString()} cones · {desc}
                {ros[0]?.orders?.clients ? ` · ${ros[0].orders.clients.dba ?? ros[0].orders.clients.legal_name}` : ""}
                {r.promise_date ? ` · PROMISE ${r.promise_date}` : ""}
              </p>
              {r.status === "placed" && <RunConfirm runId={r.id} />}
            </div>
          );
        })}
        {!runs?.length && <p className="px-4 py-6 text-[11px]" style={{ color: "#6E756B" }}>No open runs.</p>}
      </div>
    </div>
  );
}
