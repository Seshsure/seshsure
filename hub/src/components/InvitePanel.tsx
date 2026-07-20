"use client";
import { useState } from "react";

export function InvitePanel({ clientId, defaultEmail, held }: { clientId: string; defaultEmail?: string; held: boolean }) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [state, setState] = useState<"idle"|"busy"|"done"|"err">("idle");
  const [msg, setMsg] = useState("");

  async function send() {
    setState("busy"); setMsg("");
    const r = await fetch("/api/clients/invite", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId, email }) });
    const j = await r.json();
    if (!r.ok) { setState("err"); setMsg(j.error); return; }
    setState("done"); setMsg(j.message);
  }

  if (held) return (
    <div className="rounded-lg border-2 mt-4 px-4 py-3" style={{ borderColor: "#E7DFCE", background: "#FFFFFF" }}>
      <span className="eyebrow" style={{ color: "#D62839" }}>PORTAL INVITE BLOCKED — CLIENT ON HOLD</span>
      <p className="text-[10px] mt-1" style={{ color: "#6E6A5E" }}>Litigation/held accounts don&apos;t get portal access. Resolve the hold first.</p>
    </div>
  );

  return (
    <div className="rounded-lg border mt-4 px-4 py-3" style={{ borderColor: "#E7DFCE", background: "#FFFFFF" }}>
      <span className="eyebrow" style={{ color: "#6E6A5E" }}>INVITE TO PORTAL — ONBOARDING REQUIRED BEFORE ACCESS</span>
      <div className="flex gap-2 mt-2">
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="ap@client.com"
          className="flex-1 px-3 py-2 rounded-lg text-[12px] border-2 outline-none" style={{ borderColor: "#E7DFCE" }} />
        <button onClick={send} disabled={state === "busy" || !email.includes("@")}
          className="punch-sm px-4 py-2 rounded-lg font-bold text-[11px] disabled:opacity-50" style={{ background: "#0D9488", color: "#fff" }}>
          {state === "busy" ? "Sending…" : "Send invite"}
        </button>
      </div>
      {state === "done" && <p className="font-mono text-[9px] mt-2 font-bold" style={{ color: "#0D9488" }}>✓ {msg} — they&apos;ll set a password, then sign terms before the portal opens</p>}
      {state === "err" && <p className="font-mono text-[9px] mt-2" style={{ color: "#D62839" }}>{msg}</p>}
    </div>
  );
}
