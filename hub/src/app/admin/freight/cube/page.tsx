// ————— CUBE — live load board + planning calculator —————
// Top: what's actually in the pipeline right now, stacked against container
// space. Room left = cones you can still sell onto this sailing, and the
// air-bound orders that could ride the box instead.
import { CubeCalc } from "@/components/CubeCalc";
import { supabaseServer } from "@/lib/supabase-server";
export const dynamic = "force-dynamic";

const CONTAINERS = [
  { key: "20'", cbm: 33.2 },
  { key: "40'", cbm: 67.7 },
  { key: "40'HC", cbm: 76.3 },
];

function parseDims(note: string | null): number | null {
  if (!note) return null;                       // "60×40×40 cm" | "60x40x40"
  const m = note.replace(/,/g, ".").match(/(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const [l, w, h] = [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])];
  return (l * w * h) / 1e6;                     // cm³ → m³ per carton
}

export default async function CubePage() {
  const sb = supabaseServer();
  const { data: pipeline } = await sb.from("orders")
    .select(`id, order_number, freight_mode, status, clients(dba, legal_name),
      order_items(quantity, products(cones_per_carton, carton_l_mm, carton_w_mm, carton_h_mm)),
      run_orders(production_runs(id, status, packing_cartons, packing_dims_note, pickup_ready_date, shipped_at))`)
    .in("status", ["approved", "in_production", "ready"]);

  type Row = { order: string; client: string; mode: string; units: number; cartons: number | null; cbm: number | null; source: "packing" | "catalog" | "unknown"; ready: string | null };
  const rows: Row[] = [];
  for (const o of pipeline ?? []) {
    type Run = { status: string; packing_cartons: number | null; packing_dims_note: string | null; pickup_ready_date: string | null; shipped_at: string | null };
    const run = ((o.run_orders as unknown as { production_runs: Run }[] | null) ?? []).map(x => x.production_runs).find(Boolean);
    if (run?.shipped_at) continue;              // already on the water — not load-board cargo
    type Item = { quantity: number; products: { cones_per_carton: number | null; carton_l_mm: number | null; carton_w_mm: number | null; carton_h_mm: number | null } };
    const items = (o.order_items as unknown as Item[] | null) ?? [];
    const units = items.reduce((s, it) => s + Number(it.quantity), 0);
    const client = (o.clients as unknown as { dba: string | null; legal_name: string }) ?? { dba: null, legal_name: "—" };

    let cartons: number | null = null, cbm: number | null = null, source: Row["source"] = "unknown";
    if (run?.packing_cartons) {                 // truth: the factory's packing sheet
      cartons = run.packing_cartons;
      const per = parseDims(run.packing_dims_note);
      cbm = per ? cartons * per : null;
      source = "packing";
    } else {                                    // estimate: catalog carton specs
      let c = 0, v = 0, ok = false;
      for (const it of items) {
        const pr = it.products;
        if (pr?.cones_per_carton) {
          const n = Math.ceil(Number(it.quantity) / pr.cones_per_carton);
          c += n; ok = true;
          if (pr.carton_l_mm && pr.carton_w_mm && pr.carton_h_mm)
            v += n * (pr.carton_l_mm * pr.carton_w_mm * pr.carton_h_mm) / 1e9;
        }
      }
      if (ok) { cartons = c; cbm = v || null; source = "catalog"; }
    }
    rows.push({ order: o.order_number, client: client.dba ?? client.legal_name, mode: o.freight_mode ?? "sea",
      units, cartons, cbm, source, ready: run?.pickup_ready_date ?? null });
  }

  const sea = rows.filter(r => r.mode !== "air");
  const air = rows.filter(r => r.mode === "air");
  const totalCbm = sea.reduce((s, r) => s + (r.cbm ?? 0), 0);
  const totalUnits = sea.reduce((s, r) => s + r.units, 0);
  const unsized = sea.filter(r => r.cbm === null).length;
  const density = totalCbm > 0 && totalUnits > 0 ? totalUnits / totalCbm : null;  // cones per m³, from this load

  return (
    <div className="max-w-5xl mx-auto px-4 pb-8">
      <p className="display text-[19px] mt-5" style={{ color: "#181818" }}>CUBE — LIVE LOAD</p>

      {rows.length === 0 ? (
        <div className="rounded-xl border-2 p-5 mt-4 bg-white" style={{ borderColor: "#E7DFCE" }}>
          <p className="text-[13px] font-semibold" style={{ color: "#181818" }}>No cargo in the pipeline yet</p>
          <p className="text-[12px] mt-1" style={{ color: "#3E3A30" }}>Approved and in-production orders will stack here against container space — showing room left to sell, and air orders that could ride the box.</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border-2 bg-white p-4 mt-4" style={{ borderColor: "#181818" }}>
            <p className="eyebrow" style={{ color: "#3E3A30" }}>OCEAN-BOUND CARGO — READY & IN PRODUCTION</p>
            {sea.map(r => (
              <div key={r.order} className="flex items-center justify-between py-2 border-b last:border-0 text-[13px]" style={{ borderColor: "#E7DFCE" }}>
                <div>
                  <span className="font-mono font-bold" style={{ color: "#181818" }}>{r.order}</span>
                  <span className="ml-2" style={{ color: "#3E3A30" }}>{r.client}</span>
                  {r.ready && <span className="font-mono text-[10px] ml-2" style={{ color: "#0D9488" }}>READY {r.ready}</span>}
                </div>
                <span className="font-mono text-[12px]" style={{ color: "#181818" }}>
                  {r.units.toLocaleString()} cones · {r.cartons ?? "?"} ctns · {r.cbm ? r.cbm.toFixed(1) + " m³" : "size unknown"}
                  <span className="text-[9px] ml-1" style={{ color: r.source === "packing" ? "#0D9488" : r.source === "catalog" ? "#C77800" : "#D62839" }}>
                    {r.source === "packing" ? "PACKED" : r.source === "catalog" ? "EST" : "NO SPECS"}</span>
                </span>
              </div>
            ))}
            <div className="flex justify-between mt-3">
              <span className="eyebrow" style={{ color: "#3E3A30" }}>TOTAL{unsized ? ` (${unsized} UNSIZED)` : ""}</span>
              <span className="font-mono text-[14px] font-bold" style={{ color: "#181818" }}>{totalUnits.toLocaleString()} cones · {totalCbm.toFixed(1)} m³</span>
            </div>

            <div className="mt-4 space-y-2">
              {CONTAINERS.map(c => {
                const pct = Math.min(100, (totalCbm / c.cbm) * 100);
                const roomCbm = Math.max(0, c.cbm - totalCbm);
                const roomCones = density ? Math.floor(roomCbm * density) : null;
                return (
                  <div key={c.key}>
                    <div className="flex justify-between font-mono text-[11px]">
                      <span style={{ color: "#3E3A30" }}>{c.key} — {pct.toFixed(0)}% FULL</span>
                      <span style={{ color: pct >= 100 ? "#D62839" : "#0D9488" }}>
                        {pct >= 100 ? "OVERFLOW — SPLIT OR SIZE UP" : `ROOM: ${roomCbm.toFixed(1)} m³${roomCones ? ` ≈ ${roomCones.toLocaleString()} MORE CONES TO SELL` : ""}`}
                      </span>
                    </div>
                    <div className="h-2 rounded mt-1" style={{ background: "#E7DFCE" }}>
                      <div className="h-2 rounded" style={{ width: `${pct}%`, background: pct >= 100 ? "#D62839" : pct >= 80 ? "#0D9488" : "#C77800" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {air.length > 0 && (
            <div className="rounded-xl border-2 p-4 mt-4" style={{ borderColor: "#C77800", background: "#FFFFFF" }}>
              <p className="eyebrow" style={{ color: "#C77800" }}>AIR-BOUND — CANDIDATES TO RIDE THE BOX</p>
              {air.map(r => (
                <div key={r.order} className="flex items-center justify-between py-2 text-[13px]">
                  <span><span className="font-mono font-bold" style={{ color: "#181818" }}>{r.order}</span><span className="ml-2" style={{ color: "#3E3A30" }}>{r.client}</span></span>
                  <span className="font-mono text-[12px]" style={{ color: "#181818" }}>{r.units.toLocaleString()} cones{r.cbm ? ` · ${r.cbm.toFixed(1)} m³` : ""}</span>
                </div>
              ))}
              <p className="font-mono text-[10px] mt-1" style={{ color: "#5C574A" }}>IF THE CONTAINER HAS ROOM AND THEIR DATES ALLOW, OCEAN RIDES NEARLY FREE — THE PITCH: SAME CONES, WEEKS EARLIER ORDERING, FRACTION OF THE FREIGHT.</p>
            </div>
          )}
        </>
      )}

      <p className="display text-[15px] mt-8" style={{ color: "#181818" }}>PLANNING CALCULATOR</p>
      <p className="text-[12px] mt-1" style={{ color: "#3E3A30" }}>What-if math for cartons and containers — independent of live orders.</p>
      <CubeCalc />
    </div>
  );
}
