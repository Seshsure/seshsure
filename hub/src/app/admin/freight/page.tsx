import { supabaseServer } from "@/lib/supabase-server";
import { formatUSD } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function Freight() {
  const sb = supabaseServer();
  const ninety = new Date(Date.now() - 90 * 864e5).toISOString();
  const [{ data: rfqs }, { data: exceptions }, { data: moving }, { data: laneHistory }] = await Promise.all([
    sb.from("freight_rfqs").select("id, mode, cargo_summary, status, bid_deadline, units_count, freight_bids(id, all_in_cents, transit_days, valid_until, eta_delivery, notes, forwarders(name))").eq("status", "open").order("created_at", { ascending: false }),
    sb.from("logistics_exceptions").select("id, kind, detail, opened_at, shipments(id)").is("resolved_at", null).order("opened_at"),
    sb.from("shipments").select("id, status, eta, last_scan_at, free_days, arrived_port_at").is("delivered_at", null).limit(15),
    sb.from("freight_bids").select("all_in_cents, created_at, freight_rfqs(mode, cargo_summary)").gte("created_at", ninety),
  ]);

  // self-generating market index: every quote ever received teaches the lane
  type LH = { all_in_cents: number; freight_rfqs: { mode: string; cargo_summary: Record<string, unknown> | null } };
  const laneKey = (mode: string, cs: Record<string, unknown> | null | undefined) =>
    `${mode}|${String(cs?.origin ?? "?")}→${String(cs?.destination ?? "?")}`;
  const lanes = new Map<string, { sum: bigint; n: number; best: bigint }>();
  for (const h of (laneHistory ?? []) as unknown as LH[]) {
    const k = laneKey(h.freight_rfqs?.mode ?? "?", h.freight_rfqs?.cargo_summary);
    const v = lanes.get(k) ?? { sum: 0n, n: 0, best: BigInt(h.all_in_cents) };
    v.sum += BigInt(h.all_in_cents); v.n += 1;
    if (BigInt(h.all_in_cents) < v.best) v.best = BigInt(h.all_in_cents);
    lanes.set(k, v);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 pb-8">
      {(exceptions?.length ?? 0) > 0 && (
        <div className="mt-4 rounded-lg border overflow-hidden" style={{ background: "#FFFFFF", borderColor: "#E6394655" }}>
          <div className="px-3 py-2 border-b" style={{ borderColor: "#E7DFCE" }}>
            <span className="text-[12px] font-mono font-bold" style={{ color: "#E63946" }}>EXCEPTIONS — NEED EYES</span>
          </div>
          {(exceptions ?? []).map(e => (
            <div key={e.id} className="px-3 py-2.5 border-b" style={{ borderColor: "#E7DFCE" }}>
              <p className="text-[13px] font-semibold" style={{ color: "#181818" }}>{e.kind.replace(/_/g," ").toUpperCase()}</p>
              <p className="font-mono text-[10px]" style={{ color: "#3E3A30" }}>{e.detail}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-lg border overflow-hidden" style={{ background: "#FFFFFF", borderColor: "#E7DFCE" }}>
        <div className="px-3 py-2 border-b" style={{ borderColor: "#E7DFCE" }}>
          <span className="text-[12px] font-mono font-bold" style={{ color: "#3E3A30" }}>OPEN RFQS — THE DESK</span>
        </div>
        {(rfqs ?? []).map(r => {
          const c = r.cargo_summary as Record<string, string | number>;
          type B = { id: string; all_in_cents: number; transit_days: number | null; valid_until: string | null; eta_delivery: string | null; notes: string | null; forwarders: { name: string } };
          const today = new Date().toISOString().slice(0, 10);
          const lane = lanes.get(laneKey(r.mode, c as Record<string, unknown>));
          const laneAvg = lane && lane.n >= 3 ? lane.sum / BigInt(lane.n) : null;
          const bids = ((r.freight_bids ?? []) as unknown as B[]).sort((a, b) => a.all_in_cents - b.all_in_cents);
          return (
            <div key={r.id} className="px-3 py-2.5 border-b" style={{ borderColor: "#E7DFCE" }}>
              <p className="text-[14px] font-bold" style={{ color: "#181818" }}>
                {String(r.mode).toUpperCase()} · {c.cartons} ctns · {c.originPort} → {c.destination}
              </p>
              {bids.map(b => (
                <div key={b.id} className="flex items-center mt-1.5 pl-2">
                  <span className="flex-1 text-[13px]" style={{ color: "#181818" }}>{b.forwarders?.name}
                    <span className="font-mono text-[10px] ml-2" style={{ color: "#5C574A" }}>{b.transit_days ? `${b.transit_days}D TRANSIT` : ""}</span>
                  </span>
                  <span className="font-mono text-[14px] font-bold" style={{ color: "#181818" }}>{formatUSD(BigInt(b.all_in_cents))}
                      {/* LANE-INTEL */}
                      {(() => {
                        const expired = b.valid_until && b.valid_until < today;
                        const delta = laneAvg ? Number((BigInt(b.all_in_cents) - laneAvg) * 1000n / laneAvg) / 10 : null;
                        const isBest = lane && BigInt(b.all_in_cents) <= lane.best;
                        const perK = r.units_count ? Number(BigInt(b.all_in_cents) / BigInt(Math.max(1, Math.round(Number(r.units_count) / 1000)))) / 100 : null;
                        return (
                          <span className="block font-mono text-[10px] mt-0.5">
                            {expired && <span style={{ color: "#C77800" }}>EXPIRED {b.valid_until} · </span>}
                            {delta !== null && <span style={{ color: delta <= 0 ? "#0D9488" : "#D62839" }}>{delta <= 0 ? "" : "+"}{delta}% VS 90D LANE AVG · </span>}
                            {isBest && <span style={{ color: "#0D9488" }}>★ BEST EVER THIS LANE · </span>}
                            {perK !== null && <span style={{ color: "#3E3A30" }}>${'{'}perK.toFixed(2){'}'}/1,000 CONES</span>}
                          </span>
                        );
                      })()}</span>
                </div>
              ))}
              {!bids.length && <p className="font-mono text-[10px] mt-1" style={{ color: "#5C574A" }}>AWAITING QUOTES</p>}
            </div>
          );
        })}
        {!rfqs?.length && <p className="px-3 py-4 text-[13px]" style={{ color: "#5C574A" }}>No open RFQs.</p>}
      </div>

      <div className="mt-4 rounded-lg border overflow-hidden" style={{ background: "#FFFFFF", borderColor: "#E7DFCE" }}>
        <div className="px-3 py-2 border-b" style={{ borderColor: "#E7DFCE" }}>
          <span className="text-[12px] font-mono font-bold" style={{ color: "#3E3A30" }}>IN MOTION</span>
        </div>
        {(moving ?? []).map(s => (
          <div key={s.id} className="flex items-center px-3 py-2.5 border-b" style={{ borderColor: "#E7DFCE" }}>
            <span className="flex-1 text-[13px]" style={{ color: "#181818" }}>{String(s.status).replace(/_/g," ").toUpperCase()}</span>
            <span className="font-mono text-[10px]" style={{ color: "#5C574A" }}>
              {s.eta ? `ETA ${s.eta}` : ""}{s.arrived_port_at && s.free_days ? ` · FREE DAYS BURNING` : ""}
            </span>
          </div>
        ))}
        {!moving?.length && <p className="px-3 py-4 text-[13px]" style={{ color: "#5C574A" }}>Nothing on the water.</p>}
      </div>
    </div>
  );
}
