"use client";
import { useState } from "react";

export function InterestControl({ invoiceId, frozen }: { invoiceId: string; frozen: boolean }) {
  const [isFrozen, setFrozen] = useState(frozen);
  const [busy, setBusy] = useState(false);

  async function flip() {
    const declaring = isFrozen;
    if (declaring && !confirm("Declare default on this invoice? Interest (1.5%/mo) starts accruing from the next cycle. This is logged.")) return;
    setBusy(true);
    const r = await fetch("/api/invoices/interest", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ invoiceId, action: declaring ? "declare_default" : "restore_grace" }) });
    if (r.ok) setFrozen(!declaring ? true : false);
    setBusy(false);
  }

  return (
    <button onClick={flip} disabled={busy} className="font-mono text-[8px] font-bold px-2 py-1.5 rounded border-2 disabled:opacity-50"
      style={isFrozen
        ? { borderColor: "#E7DFCE", color: "#514C41", background: "transparent" }
        : { borderColor: "#181818", color: "#FFFFFF", background: "#D62839", boxShadow: "2px 2px 0 #181818" }}>
      {busy ? "…" : isFrozen ? "GRACE" : "⚠ INTEREST RUNNING"}
    </button>
  );
}
