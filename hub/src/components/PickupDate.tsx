"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function PickupDate({ runId, current }: { runId: string; current: string | null }) {
  const [val, setVal] = useState(current ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();

  async function save() {
    setBusy(true); setErr("");
    const r = await fetch("/api/factory/pickup", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId, pickupReadyDate: val }) });
    setBusy(false);
    if (!r.ok) { const j = await r.json().catch(() => ({})); setErr(j.error ?? "failed"); return; }
    router.refresh();
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="eyebrow" style={{ color: "#5C574A" }}>CARGO READY FOR PICKUP:</span>
      <input type="date" className="px-2 py-1 rounded border-2 font-mono text-[12px] outline-none bg-white" style={{ borderColor: "#E7DFCE" }}
        value={val} onChange={e => setVal(e.target.value)} />
      <button onClick={save} disabled={busy || !val || val === current}
        className="font-mono text-[10px] font-bold px-2.5 py-1.5 rounded disabled:opacity-40" style={{ background: "#0D9488", color: "#fff" }}>
        {busy ? "…" : current ? "UPDATE" : "SET"}
      </button>
      {current && <span className="font-mono text-[10px]" style={{ color: "#0D9488" }}>✓ {current} — SESHSURE ARRANGES PICKUP</span>}
      {err && <span className="font-mono text-[10px]" style={{ color: "#D62839" }}>{err}</span>}
    </div>
  );
}
