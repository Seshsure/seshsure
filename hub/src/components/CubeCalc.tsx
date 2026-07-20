"use client";
import { useEffect, useState } from "react";

// interior dims (cm) and payload — industry-standard workable figures
const CONTAINERS = [
  { key: "20GP", name: "20' Standard", L: 589, W: 235, H: 239, kg: 21700 },
  { key: "40GP", name: "40' Standard", L: 1203, W: 235, H: 239, kg: 26500 },
  { key: "40HC", name: "40' High-Cube", L: 1203, W: 235, H: 269, kg: 26500 },
];

type Preset = { id: string; name: string; carton_l_cm: number; carton_w_cm: number; carton_h_cm: number; units_per_carton: number; carton_kg: number | null };

export function CubeCalc() {
  const [L, setL] = useState("60"); const [W, setW] = useState("40"); const [H, setH] = useState("40");
  const [units, setUnits] = useState("1000"); const [kg, setKg] = useState("");
  const [freightUsd, setFreightUsd] = useState("");
  const [presets, setPresets] = useState<Preset[]>([]);
  const [saveName, setSaveName] = useState("");

  useEffect(() => { fetch("/api/freight/presets").then(r => r.json()).then(j => setPresets(j.presets ?? [])); }, []);

  const l = parseFloat(L) || 0, w = parseFloat(W) || 0, h = parseFloat(H) || 0;
  const u = parseInt(units) || 0, ckg = parseFloat(kg) || 0, f = parseFloat(freightUsd) || 0;
  const cartonVol = (l * w * h) / 1e6; // m3

  function fit(c: typeof CONTAINERS[number]) {
    if (!l || !w || !h) return null;
    // best axis-aligned orientation (floor grid × stack height)
    const orients: [number, number, number][] = [[l,w,h],[l,h,w],[w,l,h],[w,h,l],[h,l,w],[h,w,l]];
    let best = 0;
    for (const [a, b2, c2] of orients) {
      const n = Math.floor(c.L / a) * Math.floor(c.W / b2) * Math.floor(c.H / c2);
      if (n > best) best = n;
    }
    const byWeight = ckg > 0 ? Math.floor(c.kg / ckg) : Infinity;
    const cartons = Math.min(best, byWeight);
    const cones = cartons * u;
    const util = (cartons * cartonVol) / ((c.L * c.W * c.H) / 1e6);
    const perK = f > 0 && cones > 0 ? (f / cones) * 1000 : null;
    return { cartons, cones, util, perK, weightBound: byWeight < best };
  }

  async function savePreset() {
    if (saveName.length < 2) return;
    await fetch("/api/freight/presets", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: saveName, cartonLCm: l, cartonWCm: w, cartonHCm: h, unitsPerCarton: u, cartonKg: ckg || undefined }) });
    setSaveName("");
    fetch("/api/freight/presets").then(r => r.json()).then(j => setPresets(j.presets ?? []));
  }

  const inp = "w-full mt-1 px-3 py-2.5 rounded-lg text-[14px] border-2 outline-none bg-white";
  const lbl = "eyebrow block mt-3";

  return (
    <div className="grid md:grid-cols-5 gap-5 mt-5">
      <div className="md:col-span-2">
        <div className="punch rounded-xl bg-white p-5">
          <p className="eyebrow" style={{ color: "#3E3A30" }}>MASTER CARTON</p>
          {presets.length > 0 && (
            <select className={inp} style={{ borderColor: "#E7DFCE" }} defaultValue=""
              onChange={e => { const p = presets.find(x => x.id === e.target.value); if (p) { setL(String(p.carton_l_cm)); setW(String(p.carton_w_cm)); setH(String(p.carton_h_cm)); setUnits(String(p.units_per_carton)); setKg(p.carton_kg ? String(p.carton_kg) : ""); } }}>
              <option value="" disabled>Load a saved carton…</option>
              {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <div className="grid grid-cols-3 gap-3">
            {[["L (cm)", L, setL], ["W (cm)", W, setW], ["H (cm)", H, setH]].map(([label, val, set]) => (
              <div key={label as string}><label className={lbl} style={{ color: "#5C574A" }}>{label as string}</label>
                <input inputMode="decimal" className={inp} style={{ borderColor: "#E7DFCE" }} value={val as string}
                  onChange={e => (set as (v: string) => void)(e.target.value.replace(/[^\d.]/g, ""))} /></div>
            ))}
          </div>
          <label className={lbl} style={{ color: "#5C574A" }}>CONES PER CARTON</label>
          <input inputMode="numeric" className={inp} style={{ borderColor: "#E7DFCE" }} value={units} onChange={e => setUnits(e.target.value.replace(/\D/g, ""))} />
          <label className={lbl} style={{ color: "#5C574A" }}>CARTON WEIGHT (KG) — OPTIONAL</label>
          <input inputMode="decimal" className={inp} style={{ borderColor: "#E7DFCE" }} value={kg} onChange={e => setKg(e.target.value.replace(/[^\d.]/g, ""))} />
          <label className={lbl} style={{ color: "#5C574A" }}>QUOTED FREIGHT ALL-IN (USD) — OPTIONAL</label>
          <input inputMode="decimal" className={inp} style={{ borderColor: "#E7DFCE" }} value={freightUsd} onChange={e => setFreightUsd(e.target.value.replace(/[^\d.]/g, ""))} />
          <div className="flex gap-2 mt-4">
            <input placeholder="Save as… (e.g. 109/26 export carton)" className={inp + " mt-0 flex-1"} style={{ borderColor: "#E7DFCE" }} value={saveName} onChange={e => setSaveName(e.target.value)} />
            <button onClick={savePreset} className="punch-sm px-3 rounded-lg font-bold text-[12px]" style={{ background: "#181818", color: "#fff" }}>Save</button>
          </div>
        </div>
      </div>
      <div className="md:col-span-3 space-y-4">
        {CONTAINERS.map(c => {
          const r = fit(c);
          return (
            <div key={c.key} className="rounded-xl border-2 bg-white p-4" style={{ borderColor: "#181818" }}>
              <div className="flex items-center justify-between">
                <p className="display text-[15px]" style={{ color: "#181818" }}>{c.name}</p>
                {r && <span className="eyebrow" style={{ color: r.util >= 0.85 ? "#0D9488" : r.util >= 0.7 ? "#C77800" : "#D62839" }}>
                  {(r.util * 100).toFixed(0)}% CUBE{r.weightBound ? " · WEIGHT-BOUND" : ""}</span>}
              </div>
              {r ? (
                <div className="grid grid-cols-3 gap-4 mt-3">
                  <div><span className="eyebrow" style={{ color: "#5C574A" }}>CARTONS</span>
                    <p className="font-mono text-[17px] font-bold" style={{ color: "#181818" }}>{r.cartons.toLocaleString()}</p></div>
                  <div><span className="eyebrow" style={{ color: "#5C574A" }}>CONES</span>
                    <p className="font-mono text-[17px] font-bold" style={{ color: "#181818" }}>{r.cones.toLocaleString()}</p></div>
                  <div><span className="eyebrow" style={{ color: "#5C574A" }}>FREIGHT / 1,000</span>
                    <p className="font-mono text-[17px] font-bold" style={{ color: r.perK !== null ? "#0D9488" : "#9B9484" }}>
                      {r.perK !== null ? `$${r.perK.toFixed(2)}` : "—"}</p></div>
                </div>
              ) : <p className="text-[12px] mt-2" style={{ color: "#5C574A" }}>Enter carton dims</p>}
            </div>
          );
        })}
        <p className="font-mono text-[10px] leading-relaxed" style={{ color: "#5C574A" }}>
          INTERIOR DIMS ARE INDUSTRY-WORKABLE FIGURES; REAL LOADS LOSE A FEW % TO PALLETS/DUNNAGE IF NOT FLOOR-LOADED.
          FLOOR-LOADED CARTONS (NO PALLETS) IS THE CHEAPEST WAY TO SHIP CONES — LABOR AT DESTINATION IS THE TRADE.
        </p>
      </div>
    </div>
  );
}
