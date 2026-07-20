// Client tracking — exactly four milestones, RLS-walled at the database
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const MILESTONES = [
  ["arrived_us_port", "Arrived US port"],
  ["customs_cleared", "Customs cleared"],
  ["out_for_delivery", "Out for delivery"],
  ["delivered", "Delivered"],
] as const;

export default async function Tracking() {
  const sb = supabaseServer();
  const { data: orders } = await sb.from("orders")
    .select("id, order_number, po_number, status, shipments(id, eta, delivered_at, shipment_milestones(code, occurred_at))")
    .in("status", ["in_production", "shipped", "delivered"])
    .order("created_at", { ascending: false }).limit(10);

  return (
    <div className="max-w-3xl mx-auto px-4 py-5">
      <h1 className="font-bold text-[16px] mb-1" style={{ color: "#15181A" }}>Where&apos;s my order</h1>
      <p className="text-[10px] font-mono mb-3" style={{ color: "#6E756B" }}>TRACKING BEGINS AT US ARRIVAL · ETAS UPDATE LIVE</p>
      <div className="space-y-3">
        {(orders ?? []).map(o => {
          type Ship = { id: string; eta: string | null; delivered_at: string | null; shipment_milestones: { code: string; occurred_at: string }[] };
          const ship = ((o.shipments ?? []) as unknown as Ship[])[0];
          const hit = new Map((ship?.shipment_milestones ?? []).map(m => [m.code, m.occurred_at]));
          const inProduction = o.status === "in_production" && !hit.size;
          return (
            <div key={o.id} className="rounded-xl border p-4" style={{ background: "#fff", borderColor: "#E4E1DA" }}>
              <div className="flex items-center justify-between">
                <p className="font-mono text-[11px] font-bold" style={{ color: "#15181A" }}>{o.order_number ?? "ORDER"} · PO {o.po_number}</p>
                <span className="font-mono text-[8px] font-bold" style={{ color: o.status === "delivered" ? "#0D9488" : "#6E756B" }}>
                  {inProduction ? "IN PRODUCTION" : String(o.status).replace(/_/g, " ").toUpperCase()}
                </span>
              </div>
              <div className="mt-3 space-y-0">
                {MILESTONES.map(([code, label], i) => {
                  const when = hit.get(code);
                  const done = !!when;
                  return (
                    <div key={code} className="flex items-start">
                      <div className="flex flex-col items-center mr-3">
                        <div className="w-3 h-3 rounded-full border-2 flex items-center justify-center"
                          style={{ borderColor: done ? "#0D9488" : "#D9D6CE", background: done ? "#0D9488" : "#fff" }}>
                          {done && <span className="text-[6px]" style={{ color: "#fff" }}>✓</span>}
                        </div>
                        {i < 3 && <div className="w-0.5 h-5" style={{ background: done ? "#0D9488" : "#E4E1DA" }} />}
                      </div>
                      <div className="pb-2">
                        <p className="text-[11px] font-semibold leading-3" style={{ color: done ? "#15181A" : "#9B9F98" }}>{label}</p>
                        {when && <p className="font-mono text-[7px] mt-0.5" style={{ color: "#6E756B" }}>{new Date(when).toLocaleDateString()}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {ship?.eta && !ship.delivered_at && (
                <p className="font-mono text-[9px] mt-1 font-bold" style={{ color: "#0D9488" }}>ETA {ship.eta}</p>
              )}
            </div>
          );
        })}
        {!orders?.length && <p className="text-[11px]" style={{ color: "#6E756B" }}>Nothing in motion right now.</p>}
      </div>
    </div>
  );
}
