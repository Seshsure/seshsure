"use client";
import { useEffect, useState } from "react";

export function SignForm({ token }: { token: string }) {
  const [body, setBody] = useState("");
  const [f, setF] = useState({ signerName: "", signerTitle: "", signerCompany: "" });
  const [state, setState] = useState<"load"|"idle"|"busy"|"done"|"err">("load");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`/api/public/esign?token=${token}`).then(r => r.json()).then(j => {
      if (j.ok) { setBody(j.body); setF(prev => ({ ...prev, signerCompany: j.recipientCompany ?? "" })); setState("idle"); }
      else { setMsg(j.error === "already signed" ? "This agreement is already signed — you're all set." : "This link isn't valid. Reach your SeshSure contact for a fresh one."); setState("err"); }
    });
  }, [token]);

  async function sign() {
    setState("busy");
    const r = await fetch("/api/public/esign", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, ...f }) });
    const j = await r.json();
    if (!r.ok) { setState("idle"); setMsg(j.error); return; }
    setState("done"); setMsg(j.message);
  }

  if (state === "load") return <p className="font-mono text-[12px] mt-6" style={{ color: "#5C574A" }}>Loading…</p>;
  if (state === "err") return <div className="punch-sm rounded-xl bg-white p-5 mt-5"><p className="text-[14px] font-bold" style={{ color: "#181818" }}>{msg}</p></div>;
  if (state === "done") return <div className="punch rounded-xl bg-white p-6 mt-5 text-center"><p className="text-[16px] font-bold" style={{ color: "#0D9488" }}>✓ {msg}</p></div>;

  const inp = "w-full mt-1 px-3 py-2.5 rounded-lg text-[14px] border-2 outline-none bg-white";
  return (
    <>
      <div className="rounded-xl border-2 bg-white mt-5 p-5 max-h-[50vh] overflow-y-auto" style={{ borderColor: "#181818" }}>
        <div className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: "#181818" }}>{body}</div>
      </div>
      <div className="punch rounded-xl bg-white p-5 mt-4">
        <p className="eyebrow" style={{ color: "#3E3A30" }}>SIGN — NAME, TITLE, TIMESTAMP, IP, AND DEVICE ARE RECORDED</p>
        <label className="eyebrow block mt-3" style={{ color: "#5C574A" }}>FULL LEGAL NAME *</label>
        <input className={inp} style={{ borderColor: "#E7DFCE" }} value={f.signerName} onChange={e => setF({ ...f, signerName: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <div><label className="eyebrow block mt-3" style={{ color: "#5C574A" }}>TITLE *</label>
            <input className={inp} style={{ borderColor: "#E7DFCE" }} value={f.signerTitle} onChange={e => setF({ ...f, signerTitle: e.target.value })} /></div>
          <div><label className="eyebrow block mt-3" style={{ color: "#5C574A" }}>COMPANY *</label>
            <input className={inp} style={{ borderColor: "#E7DFCE" }} value={f.signerCompany} onChange={e => setF({ ...f, signerCompany: e.target.value })} /></div>
        </div>
        <button onClick={sign} disabled={state === "busy" || f.signerName.length < 3 || f.signerTitle.length < 2 || f.signerCompany.length < 2}
          className="punch-sm w-full mt-4 py-3 rounded-lg font-bold text-[14px] disabled:opacity-50" style={{ background: "#181818", color: "#fff" }}>
          {state === "busy" ? "Signing…" : "I agree — sign electronically"}
        </button>
        {msg && <p className="font-mono text-[10px] mt-2" style={{ color: "#D62839" }}>{msg}</p>}
      </div>
    </>
  );
}
