"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewFactoryButton() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();

  async function create() {
    setBusy(true); setErr("");
    const r = await fetch("/api/factories/create", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(email ? { inviteEmail: email } : {}) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) { setErr(j.error); return; }
    setOpen(false); setEmail(""); router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="punch-sm px-4 py-2 rounded-lg font-bold text-[12px]"
        style={{ background: "#181818", color: "#fff" }}>+ New factory</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#18181866" }} onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-xl punch p-5" style={{ background: "#FAF5EA" }} onClick={e => e.stopPropagation()}>
            <p className="display text-[15px]" style={{ color: "#181818" }}>NEW FACTORY</p>
            <p className="text-[12px] mt-1" style={{ color: "#3E3A30" }}>
              Gets a neutral designation (FACTORY-NN). They enter their own legal name, banking, and documents through onboarding — you assume nothing.
            </p>
            <label className="eyebrow block mt-4" style={{ color: "#5C574A" }}>INVITE EMAIL (OPTIONAL — CAN SEND LATER)</label>
            <input className="w-full mt-1 px-3 py-2.5 rounded-lg text-[14px] border-2 outline-none bg-white" style={{ borderColor: "#E7DFCE" }}
              value={email} onChange={e => setEmail(e.target.value)} placeholder="factory contact email" />
            <button onClick={create} disabled={busy} className="punch-sm w-full mt-4 py-2.5 rounded-lg font-bold text-[13px]"
              style={{ background: "#0D9488", color: "#fff" }}>{busy ? "Creating…" : email ? "Create & invite" : "Create"}</button>
            {err && <p className="font-mono text-[10px] mt-2" style={{ color: "#D62839" }}>{err}</p>}
          </div>
        </div>
      )}
    </>
  );
}
