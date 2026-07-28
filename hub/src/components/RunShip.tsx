"use client";
// ————— FACTORY SHIP FORM — the capture point for freight identifiers —————
// Appears on qc_approved runs. Mode picks the required identifier; the AWB
// check digit validates live so a mis-keyed waybill never enters the system.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { validateAwb, validateContainer } from "@/lib/freight-tracking";

const INK = "#181818", TEAL = "#0D9488", RED = "#D62839", LINE = "#E7DFCE";

export function RunShip({ runId }: { runId: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"air" | "sea" | "domestic_parcel">("air");
  const [awb, setAwb] = useState("");
  const [containerNo, setContainerNo] = useState("");
  const [blNo, setBlNo] = useState("");
  const [courierTracking, setCourierTracking] = useState("");
  const [carrier, setCarrier] = useState("");
  const [etd, setEtd] = useState("");
  const [eta, setEta] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();

  // Live identifier feedback — green formatted echo or the exact problem.
  const awbCheck = mode === "air" && awb.length >= 3 ? validateAwb(awb) : null;
  const cntCheck = mode === "sea" && containerNo.length >= 4 ? validateContainer(containerNo) : null;

  async function submit() {
    setErr(""); setBusy(true);
    const res = await fetch("/api/factory/ship", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId, mode, awb: awb || undefined, containerNo: containerNo || undefined,
        blNo: blNo || undefined, courierTracking: courierTracking || undefined,
        carrier, etd: etd || undefined, eta: eta || undefined }) });
    setBusy(false);
    if (!res.ok) { setErr((await res.json()).error ?? "failed"); return; }
    setOpen(false); router.refresh();
  }

  const input = "w-full rounded border-2 px-2 py-1.5 font-mono text-[12px] bg-white";
  const label = "font-mono text-[9px] font-bold tracking-wider mt-2 mb-0.5";

  return (
    <div className="mt-1">
      <button onClick={() => setOpen(!open)} className="px-3 py-1.5 rounded font-mono text-[11px] font-bold"
        style={{ background: INK, color: "#fff" }}>
        MARK SHIPPED {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="mt-2 rounded-lg border-2 p-3 bg-white" style={{ borderColor: LINE }}>
          <div className="flex gap-1.5">
            {(["air", "sea", "domestic_parcel"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} className="px-2.5 py-1 rounded font-mono text-[10px] font-bold uppercase"
                style={{ background: mode === m ? INK : "#F4EFE3", color: mode === m ? "#fff" : "#3E3A30" }}>{m === "domestic_parcel" ? "courier" : m === "sea" ? "ocean" : m}</button>
            ))}
          </div>

          {mode === "air" && (<>
            <p className={label} style={{ color: "#3E3A30" }}>AIR WAYBILL (AWB) — 11 DIGITS</p>
            <input className={input} style={{ borderColor: awbCheck ? (awbCheck.ok ? TEAL : RED) : LINE }}
              placeholder="176-12345675" value={awb} onChange={e => setAwb(e.target.value)} />
            {awbCheck && <p className="font-mono text-[9px] mt-0.5" style={{ color: awbCheck.ok ? TEAL : RED }}>
              {awbCheck.ok ? `✓ ${awbCheck.formatted}` : awbCheck.reason}</p>}
          </>)}

          {mode === "sea" && (<>
            <p className={label} style={{ color: "#3E3A30" }}>CONTAINER NO.</p>
            <input className={input} style={{ borderColor: cntCheck ? (cntCheck.ok ? TEAL : RED) : LINE }}
              placeholder="MSKU1234567" value={containerNo} onChange={e => setContainerNo(e.target.value)} />
            {cntCheck && <p className="font-mono text-[9px] mt-0.5" style={{ color: cntCheck.ok ? TEAL : RED }}>
              {cntCheck.ok ? `✓ ${cntCheck.formatted}` : cntCheck.reason}</p>}
            <p className={label} style={{ color: "#3E3A30" }}>BILL OF LADING NO. (IF NO CONTAINER YET)</p>
            <input className={input} style={{ borderColor: LINE }} placeholder="B/L number" value={blNo} onChange={e => setBlNo(e.target.value)} />
          </>)}

          {mode === "domestic_parcel" && (<>
            <p className={label} style={{ color: "#3E3A30" }}>TRACKING NUMBER</p>
            <input className={input} style={{ borderColor: LINE }} placeholder="DHL / FedEx / UPS number"
              value={courierTracking} onChange={e => setCourierTracking(e.target.value)} />
          </>)}

          <p className={label} style={{ color: "#3E3A30" }}>{mode === "air" ? "AIRLINE" : mode === "sea" ? "STEAMSHIP LINE" : "COURIER"}</p>
          <input className={input} style={{ borderColor: LINE }} placeholder={mode === "air" ? "Emirates SkyCargo" : mode === "sea" ? "Maersk" : "DHL"}
            value={carrier} onChange={e => setCarrier(e.target.value)} />

          <div className="flex gap-2">
            <div className="flex-1">
              <p className={label} style={{ color: "#3E3A30" }}>DEPARTS (ETD)</p>
              <input type="date" className={input} style={{ borderColor: LINE }} value={etd} onChange={e => setEtd(e.target.value)} />
            </div>
            <div className="flex-1">
              <p className={label} style={{ color: "#3E3A30" }}>ARRIVES (ETA)</p>
              <input type="date" className={input} style={{ borderColor: LINE }} value={eta} onChange={e => setEta(e.target.value)} />
            </div>
          </div>

          <button onClick={submit} disabled={busy || carrier.length < 2}
            className="mt-3 w-full py-2 rounded font-mono text-[11px] font-bold disabled:opacity-40"
            style={{ background: TEAL, color: "#fff" }}>
            {busy ? "…" : "CONFIRM SHIPPED"}
          </button>
          {err && <p className="font-mono text-[10px] mt-1" style={{ color: RED }}>{err}</p>}
        </div>
      )}
    </div>
  );
}
