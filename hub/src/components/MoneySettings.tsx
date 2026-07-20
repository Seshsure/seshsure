"use client";
import { useState } from "react";

const LABELS: Record<string, [string, string]> = {
  ach: ["ACH — PAY IN PORTAL", "One tap, no fees, fastest receipt"],
  wire: ["WIRE", "Same-day for large amounts; bank fees apply"],
  check: ["CHECK", "Mail time + clearance before production credit"],
  cash: ["CASH", "In-person only, numbered receipt issued"],
  card: ["CARD", "Convenience fee applies (disclosed before you pay)"],
};

export function MoneySettings({ accepted, preferred, bankLast4, bankVerified, checksPayableTo, remitAddress }: {
  accepted: string[]; preferred: string; bankLast4: string | null; bankVerified: boolean;
  checksPayableTo: string; remitAddress: string;
}) {
  const [sel, setSel] = useState(preferred);
  const [msg, setMsg] = useState("");

  async function choose(m: string) {
    setSel(m); setMsg("");
    const r = await fetch("/api/payment-method", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ preferred: m }) });
    const j = await r.json();
    setMsg(r.ok ? "✓ Saved" : j.error ?? "failed");
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#fff", borderColor: "#E7DFCE" }}>
      <div className="px-4 py-2.5 border-b" style={{ borderColor: "#E7DFCE" }}>
        <span className="font-mono text-[11px] font-bold" style={{ color: "#3E3A30" }}>HOW YOU PAY</span>
      </div>
      {accepted.map(m => (
        <button key={m} onClick={() => choose(m)} className="w-full flex items-center px-4 py-3 border-b text-left"
          style={{ borderColor: "#E7DFCE", background: sel === m ? "#0D948808" : "transparent" }}>
          <div className="w-3.5 h-3.5 rounded-full mr-3 border-2 flex items-center justify-center"
            style={{ borderColor: sel === m ? "#0D9488" : "#C9CCC4" }}>
            {sel === m && <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#0D9488" }} />}
          </div>
          <div>
            <p className="text-[14px] font-bold" style={{ color: "#181818" }}>{LABELS[m]?.[0] ?? m.toUpperCase()}</p>
            <p className="text-[11px]" style={{ color: "#3E3A30" }}>{LABELS[m]?.[1]}</p>
          </div>
        </button>
      ))}
      {sel === "ach" && (
        <div className="px-4 py-3 border-b" style={{ borderColor: "#E7DFCE" }}>
          <p className="font-mono text-[11px]" style={{ color: "#3E3A30" }}>
            BANK: {bankLast4 ? `••••${bankLast4} ${bankVerified ? "· VERIFIED ✓" : "· VERIFICATION PENDING"}` : "NONE ON FILE — ADD DURING NEXT PAYMENT"}
          </p>
        </div>
      )}
      {sel === "check" && (
        <div className="px-4 py-3 border-b" style={{ borderColor: "#E7DFCE" }}>
          <p className="font-mono text-[11px] leading-relaxed" style={{ color: "#3E3A30" }}>
            PAYABLE TO: {checksPayableTo}<br/>MAIL TO: {remitAddress}<br/>NOTE: PRODUCTION CREDITS WHEN FUNDS CLEAR, NOT AT DEPOSIT.
          </p>
        </div>
      )}
      {msg && <p className="px-4 py-2 font-mono text-[11px]" style={{ color: "#0D9488" }}>{msg}</p>}
    </div>
  );
}
