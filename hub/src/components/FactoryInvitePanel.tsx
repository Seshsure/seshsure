"use client";
import { useState } from "react";

export function FactoryInvitePanel({ factoryId, factoryName }: { factoryId: string; factoryName: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle"|"busy"|"done"|"err">("idle");
  const [msg, setMsg] = useState("");

  async function send() {
    setState("busy"); setMsg("");
    const r = await fetch("/api/factories/invite", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ factoryId, email }) });
    const j = await r.json();
    if (!r.ok) { setState("err"); setMsg(j.error); return; }
    setState("done"); setMsg(j.message);
  }

  return (
    <div className="rounded-lg border mt-3 px-4 py-3" style={{ borderColor: "#E7DFCE", background: "#FFFFFF" }}>
      <span className="eyebrow" style={{ color: "#3E3A30" }}>INVITE {factoryName.toUpperCase()} TO THE PRODUCTION PORTAL</span>
      <div className="flex gap-2 mt-2">
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="factory contact email"
          className="flex-1 px-3 py-2 rounded-lg text-[14px] border-2 outline-none" style={{ borderColor: "#E7DFCE" }} />
        <button onClick={send} disabled={state === "busy" || !email.includes("@")}
          className="punch-sm px-4 py-2 rounded-lg font-bold text-[12px] disabled:opacity-50" style={{ background: "#0D9488", color: "#fff" }}>
          {state === "busy" ? "Sending…" : "Send invite"}
        </button>
      </div>
      {state === "done" && <p className="font-mono text-[11px] mt-2 font-bold" style={{ color: "#0D9488" }}>✓ {msg}</p>}
      {state === "err" && <p className="font-mono text-[11px] mt-2" style={{ color: "#D62839" }}>{msg}</p>}
      <p className="font-mono text-[10px] mt-2" style={{ color: "#5C574A" }}>
        THEY GET: RUN BOARD (ACCEPT/BID RUNS) · INVOICE UPLOAD W/ THREE-WAY MATCH · CLAIMS · STATEMENTS. THEY NEVER SEE: CLIENTS, PRICES, OTHER FACTORIES.
      </p>
    </div>
  );
}
