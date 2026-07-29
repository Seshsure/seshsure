"use client";
// Owner side of the print gate: assign approved orders to a converter,
// approve submitted proofs (after the 100/100 sandbox verification),
// stop any run on variance with a recorded reason.
import { useState } from "react";
import { useRouter } from "next/navigation";

const INK = "#181818", TEAL = "#0D9488", RED = "#D62839", LINE = "#E7DFCE", ORANGE = "#B45309", PURPLE = "#6C4AB0";

export function AssignConverter({ orderId, orderNumber, converters }: {
  orderId: string; orderNumber: string; converters: [string, string][];
}) {
  const [cid, setCid] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();
  async function assign() {
    setErr(""); setBusy(true);
    const res = await fetch("/api/arcade/print", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "assign", orderId, converterId: cid }) });
    setBusy(false);
    if (!res.ok) { setErr((await res.json()).error ?? "failed"); return; }
    router.refresh();
  }
  return (
    <div className="rounded-lg border-2 p-3 mt-2 bg-white" style={{ borderColor: LINE }}>
      <p className="font-mono text-[11px] font-bold" style={{ color: INK }}>{orderNumber} · APPROVED — ASSIGN PRINT RUN</p>
      <div className="flex gap-2 mt-1.5">
        <select className="grow rounded border-2 px-2 py-1.5 font-mono text-[11px]" style={{ borderColor: LINE }}
          value={cid} onChange={e => setCid(e.target.value)}>
          <option value="">— pick print partner —</option>
          {converters.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <button onClick={assign} disabled={busy || !cid}
          className="px-4 py-1.5 rounded font-mono text-[10px] font-bold disabled:opacity-40"
          style={{ background: PURPLE, color: "#fff" }}>{busy ? "…" : "ASSIGN"}</button>
      </div>
      {converters.length === 0 && <p className="font-mono text-[9px] mt-1" style={{ color: ORANGE }}>
        No print partners yet — invite one from INVITES (role: Print Partner).</p>}
      {err && <p className="font-mono text-[10px] mt-1" style={{ color: RED }}>{err}</p>}
    </div>
  );
}

export function OwnerRunControls({ runId, status }: { runId: string; status: string }) {
  const [stopping, setStopping] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();
  async function act(body: object) {
    setErr(""); setBusy(true);
    const res = await fetch("/api/arcade/print", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { setErr((await res.json()).error ?? "failed"); return; }
    setStopping(false); router.refresh();
  }
  return (
    <div className="mt-1.5">
      <div className="flex gap-2">
        {status === "proof_submitted" && (
          <button onClick={() => act({ action: "approve_proof", runId })} disabled={busy}
            className="grow py-1.5 rounded font-mono text-[10px] font-bold disabled:opacity-40"
            style={{ background: TEAL, color: "#fff" }}>APPROVE PROOF (100/100 VERIFIED)</button>
        )}
        {status !== "stopped" && status !== "complete" && (
          <button onClick={() => setStopping(!stopping)} disabled={busy}
            className="px-3 py-1.5 rounded font-mono text-[10px] font-bold"
            style={{ background: "#fff", color: RED, border: `2px solid ${RED}` }}>STOP</button>
        )}
      </div>
      {stopping && (
        <div className="mt-1.5">
          <input className="w-full rounded border-2 px-2 py-1.5 text-[12px]" style={{ borderColor: LINE }}
            placeholder="Variance reason — recorded permanently" value={reason} onChange={e => setReason(e.target.value)} />
          <button onClick={() => act({ action: "stop", runId, reason })} disabled={busy || reason.trim().length < 4}
            className="mt-1.5 w-full py-1.5 rounded font-mono text-[10px] font-bold disabled:opacity-40"
            style={{ background: RED, color: "#fff" }}>CONFIRM FULL STOP</button>
        </div>
      )}
      {err && <p className="font-mono text-[10px] mt-1" style={{ color: RED }}>{err}</p>}
    </div>
  );
}
