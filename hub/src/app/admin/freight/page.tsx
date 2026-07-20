import { supabaseServer } from "@/lib/supabase-server";
import { formatUSD } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function Freight() {
  const sb = supabaseServer();
  const [{ data: rfqs }, { data: exceptions }, { data: moving }] = await Promise.all([
    sb.from("freight_rfqs").select("id, mode, cargo_summary, status, bid_deadline, freight_bids(id, all_in_cents, transit_days, notes, forwarders(name))").eq("status", "open").order("created_at", { ascending: false }),
    sb.from("logistics_exceptions").select("id, kind, detail, opened_at, shipments(id)").is("resolved_at", null).order("opened_at"),
    sb.from("shipments").select("id, status, eta, last_scan_at, free_days, arrived_port_at").is("delivered_at", null).limit(15),
  ]);

  return (
    <div className="max-w-5xl mx-auto px-4 pb-8">
      {(exceptions?.length ?? 0) > 0 && (
        <div className="mt-4 rounded-lg border overflow-hidden" style={{ background: "#14181B", borderColor: "#E5484D55" }}>
          <div className="px-3 py-2 border-b" style={{ borderColor: "#262C31" }}>
            <span className="text-[10px] font-mono font-bold" style={{ color: "#E5484D" }}>EXCEPTIONS — NEED EYES</span>
          </div>
          {(exceptions ?? []).map(e => (
            <div key={e.id} className="px-3 py-2.5 border-b" style={{ borderColor: "#262C31" }}>
              <p className="text-[11px] font-semibold" style={{ color: "#E8EAEC" }}>{e.kind.replace(/_/g," ").toUpperCase()}</p>
              <p className="font-mono text-[8px]" style={{ color: "#8B949C" }}>{e.detail}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-lg border overflow-hidden" style={{ background: "#14181B", borderColor: "#262C31" }}>
        <div className="px-3 py-2 border-b" style={{ borderColor: "#262C31" }}>
          <span className="text-[10px] font-mono font-bold" style={{ color: "#8B949C" }}>OPEN RFQS — THE DESK</span>
        </div>
        {(rfqs ?? []).map(r => {
          const c = r.cargo_summary as Record<string, string | number>;
          type B = { id: string; all_in_cents: number; transit_days: number | null; notes: string | null; forwarders: { name: string } };
          const bids = ((r.freight_bids ?? []) as unknown as B[]).sort((a, b) => a.all_in_cents - b.all_in_cents);
          return (
            <div key={r.id} className="px-3 py-2.5 border-b" style={{ borderColor: "#262C31" }}>
              <p className="text-[12px] font-bold" style={{ color: "#E8EAEC" }}>
                {String(r.mode).toUpperCase()} · {c.cartons} ctns · {c.originPort} → {c.destination}
              </p>
              {bids.map(b => (
                <div key={b.id} className="flex items-center mt-1.5 pl-2">
                  <span className="flex-1 text-[11px]" style={{ color: "#E8EAEC" }}>{b.forwarders?.name}
                    <span className="font-mono text-[8px] ml-2" style={{ color: "#5C666D" }}>{b.transit_days ? `${b.transit_days}D TRANSIT` : ""}</span>
                  </span>
                  <span className="font-mono text-[12px] font-bold" style={{ color: "#E8EAEC" }}>{formatUSD(BigInt(b.all_in_cents))}</span>
                </div>
              ))}
              {!bids.length && <p className="font-mono text-[8px] mt-1" style={{ color: "#5C666D" }}>AWAITING QUOTES</p>}
            </div>
          );
        })}
        {!rfqs?.length && <p className="px-3 py-4 text-[11px]" style={{ color: "#5C666D" }}>No open RFQs.</p>}
      </div>

      <div className="mt-4 rounded-lg border overflow-hidden" style={{ background: "#14181B", borderColor: "#262C31" }}>
        <div className="px-3 py-2 border-b" style={{ borderColor: "#262C31" }}>
          <span className="text-[10px] font-mono font-bold" style={{ color: "#8B949C" }}>IN MOTION</span>
        </div>
        {(moving ?? []).map(s => (
          <div key={s.id} className="flex items-center px-3 py-2.5 border-b" style={{ borderColor: "#262C31" }}>
            <span className="flex-1 text-[11px]" style={{ color: "#E8EAEC" }}>{String(s.status).replace(/_/g," ").toUpperCase()}</span>
            <span className="font-mono text-[8px]" style={{ color: "#5C666D" }}>
              {s.eta ? `ETA ${s.eta}` : ""}{s.arrived_port_at && s.free_days ? ` · FREE DAYS BURNING` : ""}
            </span>
          </div>
        ))}
        {!moving?.length && <p className="px-3 py-4 text-[11px]" style={{ color: "#5C666D" }}>Nothing on the water.</p>}
      </div>
    </div>
  );
}
