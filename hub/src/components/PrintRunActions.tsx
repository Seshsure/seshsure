"use client";
// Only the legal next gate action renders — the sequence is the UI.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadDirect } from "@/lib/upload-client";

const INK = "#181818", TEAL = "#0D9488", RED = "#D62839", LINE = "#E7DFCE", ORANGE = "#B45309";

export function PrintRunActions({ runId, status }: { runId: string; status: string }) {
  const [note, setNote] = useState("");
  const [rolls, setRolls] = useState("");
  const [overage, setOverage] = useState("");
  const [logPath, setLogPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();

  async function act(body: object) {
    setErr(""); setBusy(true);
    const res = await fetch("/api/arcade/print", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { setErr((await res.json()).error ?? "failed"); return; }
    router.refresh();
  }

  async function pickLog(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true);
    const r = await uploadDirect("factory-docs", f);
    setUploading(false);
    if (r.ok) setLogPath(r.path); else setErr(r.error);
  }

  const btn = "w-full py-2 rounded font-mono text-[10px] font-bold disabled:opacity-40 mt-2";

  if (status === "queued") return (
    <button onClick={() => act({ action: "start_proofing", runId })} disabled={busy}
      className={btn} style={{ background: INK, color: "#fff" }}>START PROOF (100 PEELS)</button>);

  if (status === "proofing") return (
    <div className="mt-2">
      <input className="w-full rounded border-2 px-2 py-1.5 text-[12px]" style={{ borderColor: LINE }}
        placeholder="Proof declaration — stock lot, adhesive lot, peel test result"
        value={note} onChange={e => setNote(e.target.value)} />
      <button onClick={() => act({ action: "submit_proof", runId, note })} disabled={busy || note.trim().length < 4}
        className={btn} style={{ background: TEAL, color: "#fff" }}>SUBMIT PROOF TO SESHSURE</button>
      {err && <p className="font-mono text-[10px] mt-1" style={{ color: RED }}>{err}</p>}
    </div>);

  if (status === "proof_submitted") return (
    <p className="font-mono text-[10px] mt-2" style={{ color: ORANGE }}>
      AWAITING SESHSURE PROOF VERIFICATION (100/100 SANDBOX REDEEM) — printing unlocks on approval.</p>);

  if (status === "proof_approved") return (
    <button onClick={() => act({ action: "start_printing", runId })} disabled={busy}
      className={btn} style={{ background: INK, color: "#fff" }}>PROOF APPROVED — START PRINTING</button>);

  if (status === "printing") return (
    <div className="mt-2">
      <input type="number" min={1} className="w-full rounded border-2 px-2 py-1.5 font-mono text-[12px]" style={{ borderColor: LINE }}
        placeholder="Total rolls printed" value={rolls} onChange={e => setRolls(e.target.value)} />
      <button onClick={() => act({ action: "declare_printed", runId, rollCount: parseInt(rolls) })}
        disabled={busy || !parseInt(rolls)}
        className={btn} style={{ background: TEAL, color: "#fff" }}>DECLARE PRINTED</button>
      {err && <p className="font-mono text-[10px] mt-1" style={{ color: RED }}>{err}</p>}
    </div>);

  if (status === "printed") return (
    <div className="mt-2">
      <p className="font-mono text-[9px] font-bold" style={{ color: "#3E3A30" }}>
        OVERAGE COUNT + SIGNED DESTRUCTION LOG — ZERO OVERAGE STILL REQUIRES THE LOG</p>
      <input type="number" min={0} className="w-full rounded border-2 px-2 py-1.5 font-mono text-[12px] mt-1" style={{ borderColor: LINE }}
        placeholder="Overage units (0 if none)" value={overage} onChange={e => setOverage(e.target.value)} />
      <input type="file" accept=".pdf,.jpg,.png" onChange={pickLog} className="font-mono text-[10px] mt-1.5" />
      {uploading && <p className="font-mono text-[9px]" style={{ color: "#5C574A" }}>uploading…</p>}
      {logPath && <p className="font-mono text-[9px]" style={{ color: TEAL }}>✓ destruction log attached</p>}
      <button onClick={() => act({ action: "log_overage", runId, overage: parseInt(overage || "0"), destructionLogPath: logPath })}
        disabled={busy || overage === "" || !logPath}
        className={btn} style={{ background: TEAL, color: "#fff" }}>LOG OVERAGE + COMPLETE PRINT GATE</button>
      {err && <p className="font-mono text-[10px] mt-1" style={{ color: RED }}>{err}</p>}
    </div>);

  if (status === "overage_logged") return (
    <p className="font-mono text-[10px] mt-2" style={{ color: TEAL }}>
      PRINT GATE COMPLETE — SeshSure reconciles against the registry; rolls ship to SeshSure&apos;s facility only.</p>);

  return null;
}
