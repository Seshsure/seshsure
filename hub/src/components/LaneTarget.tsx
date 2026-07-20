"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function LaneTarget({ laneKey, targetCents }: { laneKey: string; targetCents: number | null }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(targetCents ? String(targetCents / 100) : "");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function save() {
    setBusy(true);
    await fetch("/api/freight/target", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ laneKey, targetUsd: parseFloat(val) }) });
    setBusy(false); setEditing(false); router.refresh();
  }

  if (editing) return (
    <span className="inline-flex items-center gap-1">
      <input autoFocus inputMode="decimal" className="w-24 px-2 py-1 rounded border-2 font-mono text-[12px] outline-none"
        style={{ borderColor: "#181818" }} value={val} onChange={e => setVal(e.target.value.replace(/[^\d.]/g, ""))} />
      <button onClick={save} disabled={busy || !val} className="font-mono text-[10px] font-bold px-2 py-1 rounded"
        style={{ background: "#0D9488", color: "#fff" }}>{busy ? "…" : "SET"}</button>
    </span>
  );
  return (
    <button onClick={() => setEditing(true)} className="font-mono text-[11px] font-bold underline decoration-dotted"
      style={{ color: targetCents ? "#181818" : "#C77800" }}>
      {targetCents ? `$${(targetCents / 100).toLocaleString()}` : "SET TARGET"}
    </button>
  );
}
