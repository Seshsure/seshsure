"use client";
// Forwarder's update controls: status vocabulary, ETA, milestone note.
import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = ["picked_up", "in_transit", "arrived_port", "customs_hold", "released", "delivering"] as const;
const INK = "#181818", TEAL = "#0D9488", LINE = "#E7DFCE";

export function ShipmentUpdate({ shipmentId, currentEta }: { shipmentId: string; currentEta: string | null }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [eta, setEta] = useState(currentEta ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();

  async function submit() {
    setErr(""); setBusy(true);
    const res = await fetch("/api/forwarder/shipment", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ shipmentId, status: status || undefined,
        eta: eta && eta !== currentEta ? eta : undefined,
        arrivedPort: status === "arrived_port" || undefined,
        note: note || undefined }) });
    setBusy(false);
    if (!res.ok) { setErr((await res.json()).error ?? "failed"); return; }
    setOpen(false); setStatus(""); setNote(""); router.refresh();
  }

  return (
    <div className="mt-2">
      <button onClick={() => setOpen(!open)} className="px-3 py-1.5 rounded font-mono text-[10px] font-bold"
        style={{ background: INK, color: "#fff" }}>UPDATE {open ? "▴" : "▾"}</button>
      {open && (
        <div className="mt-2 rounded border-2 p-2.5" style={{ borderColor: LINE }}>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map(st => (
              <button key={st} onClick={() => setStatus(status === st ? "" : st)}
                className="px-2 py-1 rounded font-mono text-[9px] font-bold uppercase"
                style={{ background: status === st ? INK : "#F4EFE3", color: status === st ? "#fff" : "#3E3A30" }}>
                {st.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-2 items-end">
            <div><p className="font-mono text-[9px] font-bold" style={{ color: "#5C574A" }}>ETA</p>
              <input type="date" className="rounded border-2 px-2 py-1 font-mono text-[11px]" style={{ borderColor: LINE }}
                value={eta} onChange={e => setEta(e.target.value)} /></div>
            <div className="grow"><p className="font-mono text-[9px] font-bold" style={{ color: "#5C574A" }}>NOTE (OPTIONAL)</p>
              <input className="w-full rounded border-2 px-2 py-1 font-mono text-[11px]" style={{ borderColor: LINE }}
                placeholder="e.g. vessel departed MUN, on schedule" value={note} onChange={e => setNote(e.target.value)} /></div>
          </div>
          <button onClick={submit} disabled={busy || (!status && !note && (eta === (currentEta ?? "")))}
            className="mt-2 w-full py-1.5 rounded font-mono text-[10px] font-bold disabled:opacity-40"
            style={{ background: TEAL, color: "#fff" }}>{busy ? "…" : "SAVE UPDATE"}</button>
          {err && <p className="font-mono text-[10px] mt-1" style={{ color: "#D62839" }}>{err}</p>}
        </div>
      )}
    </div>
  );
}
