"use client";
// ————— ARCADE MODULE CARD — the client's view of a feature they may not have —————
// Renders by access state: locked (apply CTA), applied (pending), denied
// (reapply), approved (enter), suspended (read-only note). The module's
// pages themselves re-verify server-side; this card is presentation.
import { useState } from "react";
import { useRouter } from "next/navigation";

const INK = "#181818", TEAL = "#0D9488", LINE = "#E7DFCE", PURPLE = "#6C4AB0";

export function ArcadeCard({ status }: { status: string | null }) {
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();

  async function apply() {
    setErr(""); setBusy(true);
    const res = await fetch("/api/arcade/access", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "apply", note: note || undefined }) });
    setBusy(false);
    if (!res.ok) { setErr((await res.json()).error ?? "failed"); return; }
    router.refresh();
  }

  const shell = (children: React.ReactNode) => (
    <div className="rounded-lg border-2 p-4 mt-4" style={{ borderColor: INK, background: "#fff", boxShadow: `5px 5px 0 ${PURPLE}` }}>
      <div className="flex items-center justify-between">
        <p className="display text-[15px]" style={{ color: INK }}>🕹️ SESHSURE ARCADE</p>
        <span className="font-mono text-[9px] font-bold px-2 py-0.5 rounded" style={{ background: "#6C4AB015", color: PURPLE }}>WHITE-LABEL</span>
      </div>
      {children}
    </div>
  );

  if (status === "approved") return shell(<>
    <p className="text-[13px] mt-1.5" style={{ color: "#3E3A30" }}>
      Your branded word-hunt arcade is live. Orders, batches, and hunts run from here.
    </p>
    <a href="/portal/arcade" className="block text-center mt-3 py-2.5 rounded font-mono text-[11px] font-bold"
      style={{ background: INK, color: "#fff" }}>ENTER ARCADE →</a>
  </>);

  if (status === "applied") return shell(
    <p className="text-[13px] mt-1.5" style={{ color: "#3E3A30" }}>
      Application received — we review every producer by hand. You&apos;ll get an email when it&apos;s decided.
    </p>);

  if (status === "suspended") return shell(
    <p className="text-[13px] mt-1.5" style={{ color: "#B45309" }}>
      Arcade access is suspended. Live hunts continue to their published end dates; contact us to resolve.
    </p>);

  // locked (never applied) or denied (may reapply)
  return shell(<>
    <p className="text-[13px] mt-1.5" style={{ color: "#3E3A30" }}>
      Turn your cones into a collectible word hunt — peel-code arcade under your brand,
      printed and sealed by SeshSure. Approved producers only.
    </p>
    {status === "denied" && <p className="font-mono text-[10px] mt-1" style={{ color: "#B45309" }}>Previous application declined — you may reapply.</p>}
    {!open ? (
      <button onClick={() => setOpen(true)} className="mt-3 w-full py-2.5 rounded font-mono text-[11px] font-bold"
        style={{ background: INK, color: "#fff" }}>APPLY FOR ARCADE ACCESS</button>
    ) : (
      <div className="mt-3">
        <textarea className="w-full rounded border-2 px-2 py-1.5 text-[13px]" style={{ borderColor: LINE }} rows={2}
          placeholder="What would you run? (brand, market, rough volume)" value={note} onChange={e => setNote(e.target.value)} />
        <button onClick={apply} disabled={busy} className="mt-2 w-full py-2 rounded font-mono text-[11px] font-bold disabled:opacity-40"
          style={{ background: TEAL, color: "#fff" }}>{busy ? "…" : "SUBMIT APPLICATION"}</button>
        {err && <p className="font-mono text-[10px] mt-1" style={{ color: "#D62839" }}>{err}</p>}
      </div>
    )}
  </>);
}
