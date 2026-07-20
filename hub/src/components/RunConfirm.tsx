"use client";
import { useState } from "react";

export function RunConfirm({ runId }: { runId: string }) {
  const [promise, setPromise] = useState("");
  const [state, setState] = useState<"idle"|"busy"|"done">("idle");
  async function confirm() {
    setState("busy");
    await fetch("/api/runs/confirm", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId, promiseDate: promise }) });
    setState("done");
  }
  if (state === "done") return <p className="text-[10px] font-mono mt-2" style={{ color: "#0D9488" }}>✓ CONFIRMED — PROMISE {promise}</p>;
  return (
    <div className="flex gap-2 mt-2 items-end">
      <div className="flex-1">
        <label className="text-[8px] font-mono font-bold" style={{ color: "#6E6A5E" }}>PROMISE SHIP DATE</label>
        <input type="date" value={promise} onChange={e => setPromise(e.target.value)}
          className="w-full px-3 py-2 rounded-md border font-mono text-[11px]" style={{ borderColor: "#E7DFCE" }} />
      </div>
      <button onClick={confirm} disabled={state === "busy" || !promise}
        className="px-5 py-2 rounded-md font-bold text-[11px] disabled:opacity-50" style={{ background: "#181818", color: "#fff" }}>
        Confirm run
      </button>
    </div>
  );
}
