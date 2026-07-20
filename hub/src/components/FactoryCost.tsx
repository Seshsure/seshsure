"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function FactoryCost({ invoiceId, factoryCents, totalCents }: { invoiceId: string; factoryCents: number | null; totalCents: number }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(factoryCents !== null ? String(factoryCents / 100) : "");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function save() {
    setBusy(true);
    await fetch("/api/invoices/factory-cost", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ invoiceId, factoryCostUsd: parseFloat(val) }) });
    setBusy(false); setEditing(false); router.refresh();
  }

  if (editing) return (
    <span className="inline-flex items-center gap-1">
      <input autoFocus inputMode="decimal" className="w-24 px-2 py-1 rounded border-2 font-mono text-[12px] outline-none"
        style={{ borderColor: "#181818" }} value={val} onChange={e => setVal(e.target.value.replace(/[^\d.]/g, ""))} />
      <button onClick={save} disabled={busy || val === ""} className="font-mono text-[10px] font-bold px-2 py-1 rounded"
        style={{ background: "#0D9488", color: "#fff" }}>{busy ? "…" : "SET"}</button>
    </span>
  );
  if (factoryCents === null) return (
    <button onClick={() => setEditing(true)} className="font-mono text-[10px] font-bold underline decoration-dotted" style={{ color: "#C77800" }}>
      SET FACTORY COST
    </button>
  );
  const ours = totalCents - factoryCents;
  return (
    <button onClick={() => setEditing(true)} className="font-mono text-[10px] text-left" title="Click to edit">
      <span style={{ color: "#5C574A" }}>THEIRS </span>
      <span className="font-bold" style={{ color: "#181818" }}>${(factoryCents / 100).toLocaleString()}</span>
      <span style={{ color: "#5C574A" }}> · OURS </span>
      <span className="font-bold" style={{ color: ours >= 0 ? "#0D9488" : "#D62839" }}>${(ours / 100).toLocaleString()}</span>
    </button>
  );
}
