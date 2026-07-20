"use client";
import { useState } from "react";

export function PayPanel({ invoiceId, remainingCents }: { invoiceId: string; remainingCents: string }) {
  const [amount, setAmount] = useState((Number(remainingCents) / 100).toFixed(2));
  const [state, setState] = useState<"idle"|"busy"|"done"|"err">("idle");
  const [msg, setMsg] = useState("");

  async function pay() {
    setState("busy"); setMsg("");
    const cents = Math.round(parseFloat(amount || "0") * 100);
    const r = await fetch("/api/pay", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ invoiceId, amountCents: String(cents) }) });
    const j = await r.json();
    if (!r.ok) { setState("err"); setMsg(j.error ?? "payment failed"); return; }
    setState("done");
  }

  if (state === "done") return (
    <div className="mt-4 rounded-xl border p-5 text-center" style={{ background: "#fff", borderColor: "#E7DFCE" }}>
      <p className="text-[14px] font-bold" style={{ color: "#0D9488" }}>✓ Payment authorized</p>
      <p className="text-[10px] mt-1 font-mono" style={{ color: "#6E6A5E" }}>ACH DEBITS IN THE NEXT DAILY BATCH · RECEIPT ON CLEARANCE</p>
    </div>
  );

  return (
    <div className="mt-4 rounded-xl border p-4" style={{ background: "#fff", borderColor: "#E7DFCE" }}>
      <label className="font-mono text-[9px] font-bold" style={{ color: "#6E6A5E" }}>PAY AMOUNT (USD)</label>
      <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
        inputMode="decimal" className="w-full mt-1 px-3 py-3 rounded-lg border font-mono text-[18px]"
        style={{ borderColor: "#E7DFCE", color: "#181818" }} />
      <button onClick={pay} disabled={state === "busy" || !parseFloat(amount || "0")}
        className="w-full mt-3 py-3 rounded-lg font-bold text-[13px] disabled:opacity-50"
        style={{ background: "#0D9488", color: "#fff" }}>
        {state === "busy" ? "Authorizing…" : "Pay by ACH"}
      </button>
      {state === "err" && <p className="font-mono text-[9px] mt-2" style={{ color: "#D62839" }}>{msg}</p>}
      <p className="font-mono text-[8px] mt-3 text-center" style={{ color: "#9B9484" }}>
        BY TAPPING PAY YOU AUTHORIZE A ONE-TIME ACH DEBIT · NO CARD FEES ON ACH
      </p>
    </div>
  );
}
