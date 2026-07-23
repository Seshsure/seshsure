"use client";
import { useState } from "react";

export function SignLinkPanel({ clientId, defaultEmail }: { clientId: string; defaultEmail?: string }) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");

  async function mint() {
    setBusy(true); setErr(""); setUrl("");
    const r = await fetch("/api/esign-links", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ docKey: "sample_eval", email, clientId }) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) { setErr(j.error); return; }
    setUrl(j.url);
  }

  return (
    <div className="rounded-lg border mt-4 px-4 py-3" style={{ borderColor: "#E7DFCE", background: "#FFFFFF" }}>
      <span className="eyebrow" style={{ color: "#3E3A30" }}>SAMPLE IP AGREEMENT — REQUIRED BEFORE FLAGSHIP SAMPLES SHIP</span>
      {!url ? (
        <div className="flex gap-2 mt-2">
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="recipient email"
            className="flex-1 px-3 py-2 rounded-lg text-[13px] border-2 outline-none" style={{ borderColor: "#E7DFCE" }} />
          <button onClick={mint} disabled={busy || !email.includes("@")}
            className="punch-sm px-4 py-2 rounded-lg font-bold text-[12px] disabled:opacity-50" style={{ background: "#181818", color: "#fff" }}>
            {busy ? "…" : "Mint signing link"}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 mt-2">
          <span className="font-mono text-[10px] truncate flex-1" style={{ color: "#3E3A30" }}>{url}</span>
          <button onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="punch-sm px-3 py-1.5 rounded-lg font-bold text-[11px]" style={{ background: copied ? "#0D9488" : "#181818", color: "#fff" }}>
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>
      )}
      {err && <p className="font-mono text-[10px] mt-2" style={{ color: "#D62839" }}>{err}</p>}
    </div>
  );
}
