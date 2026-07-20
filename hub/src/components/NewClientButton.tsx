"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewClientButton() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ legalName: "", dba: "", email: "", phone: "", leadSource: "", invite: true });
  const [state, setState] = useState<"idle"|"busy"|"err">("idle");
  const [msg, setMsg] = useState("");
  const router = useRouter();

  async function submit() {
    setState("busy"); setMsg("");
    const r = await fetch("/api/clients/create", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...f, dba: f.dba || undefined, email: f.email || undefined, phone: f.phone || undefined }) });
    const j = await r.json();
    if (!r.ok) { setState("err"); setMsg(j.error); return; }
    setOpen(false); router.push(`/admin/clients/${j.clientId}`); router.refresh();
  }

  const inp = "w-full mt-1 px-3 py-2 rounded-lg text-[12px] border-2 outline-none";
  const lbl = "eyebrow block mt-3";

  return (
    <>
      <button onClick={() => setOpen(true)} className="punch-sm px-4 py-2 rounded-lg font-bold text-[11px]"
        style={{ background: "#181818", color: "#fff" }}>+ New client</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#18181866" }} onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl punch p-5" style={{ background: "#FAF5EA" }} onClick={e => e.stopPropagation()}>
            <p className="display text-[15px]" style={{ color: "#181818" }}>NEW CLIENT</p>
            <label className={lbl} style={{ color: "#514C41" }}>LEGAL NAME *</label>
            <input className={inp} style={{ borderColor: "#E7DFCE" }} value={f.legalName} onChange={e => setF({ ...f, legalName: e.target.value })} />
            <label className={lbl} style={{ color: "#514C41" }}>DBA</label>
            <input className={inp} style={{ borderColor: "#E7DFCE" }} value={f.dba} onChange={e => setF({ ...f, dba: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl} style={{ color: "#514C41" }}>CONTACT EMAIL</label>
                <input className={inp} style={{ borderColor: "#E7DFCE" }} value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
              <div><label className={lbl} style={{ color: "#514C41" }}>PHONE</label>
                <input className={inp} style={{ borderColor: "#E7DFCE" }} value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></div>
            </div>
            <label className={lbl} style={{ color: "#514C41" }}>HOW&apos;D THEY FIND YOU? *</label>
            <input className={inp} style={{ borderColor: "#E7DFCE" }} placeholder="referral — Grizzly / MJBizCon / Instagram…" value={f.leadSource} onChange={e => setF({ ...f, leadSource: e.target.value })} />
            <button onClick={() => setF({ ...f, invite: !f.invite })} className="flex items-center gap-2 mt-4">
              <span className="text-[14px]">{f.invite ? "☑" : "☐"}</span>
              <span className="text-[11px] font-bold" style={{ color: "#181818" }}>Send portal invite now (needs email)</span>
            </button>
            <button onClick={submit} disabled={state === "busy" || f.legalName.length < 2 || f.leadSource.length < 2}
              className="punch-sm w-full mt-4 py-2.5 rounded-lg font-bold text-[12px] disabled:opacity-50" style={{ background: "#0D9488", color: "#fff" }}>
              {state === "busy" ? "Creating…" : "Create client"}
            </button>
            {state === "err" && <p className="font-mono text-[9px] mt-2" style={{ color: "#D62839" }}>{msg}</p>}
          </div>
        </div>
      )}
    </>
  );
}
