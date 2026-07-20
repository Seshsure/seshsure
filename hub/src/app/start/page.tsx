"use client";
// PUBLIC intake — /start (and show mode when ?show=NAME). No login. Honeypot inside.
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function StartForm() {
  const params = useSearchParams();
  const showName = params.get("show") ?? "";
  const [f, setF] = useState({ company: "", contactName: "", email: "", phone: "", leadSource: showName ? `show:${showName}` : "", notes: "", website: "" });
  const [state, setState] = useState<"idle"|"busy"|"done"|"err">("idle");
  const [msg, setMsg] = useState("");

  async function submit() {
    setState("busy"); setMsg("");
    const r = await fetch("/api/public/prospect", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...f, showName: showName || undefined }) });
    const j = await r.json();
    if (!r.ok) { setState("err"); setMsg(j.error ?? "check the form"); return; }
    setState("done"); setMsg(j.message);
  }

  const inp = "w-full mt-1 px-3 py-3 rounded-lg text-[16px] border outline-none";
  const lbl = "block text-[11px] font-mono font-bold mt-3";

  if (state === "done") return (
    <div className="text-center py-8">
      <p className="text-[20px] font-bold" style={{ color: "#0D9488" }}>✓ Got it</p>
      <p className="text-[14px] mt-2" style={{ color: "#3E3A30" }}>{msg}</p>
      {showName && <p className="font-mono text-[11px] mt-4" style={{ color: "#5C574A" }}>ENJOY {showName.toUpperCase()} — GRAB A SAMPLE AT THE BOOTH</p>}
    </div>
  );

  return (
    <>
      <label className={lbl} style={{ color: "#3E3A30" }}>COMPANY *</label>
      <input value={f.company} onChange={e => setF({ ...f, company: e.target.value })} className={inp} style={{ borderColor: "#E7DFCE" }} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl} style={{ color: "#3E3A30" }}>YOUR NAME</label>
          <input value={f.contactName} onChange={e => setF({ ...f, contactName: e.target.value })} className={inp} style={{ borderColor: "#E7DFCE" }} />
        </div>
        <div>
          <label className={lbl} style={{ color: "#3E3A30" }}>PHONE</label>
          <input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} inputMode="tel" className={inp} style={{ borderColor: "#E7DFCE" }} />
        </div>
      </div>
      <label className={lbl} style={{ color: "#3E3A30" }}>EMAIL *</label>
      <input value={f.email} onChange={e => setF({ ...f, email: e.target.value })} type="email" className={inp} style={{ borderColor: "#E7DFCE" }} />
      {!showName && (
        <>
          <label className={lbl} style={{ color: "#3E3A30" }}>HOW&apos;D YOU HEAR ABOUT US? *</label>
          <input value={f.leadSource} onChange={e => setF({ ...f, leadSource: e.target.value })} placeholder="referral, Instagram, MJBizCon…" className={inp} style={{ borderColor: "#E7DFCE" }} />
        </>
      )}
      <label className={lbl} style={{ color: "#3E3A30" }}>WHAT DO YOU ROLL? (OPTIONAL)</label>
      <input value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} placeholder="98mm, ~500K/month, white paper…" className={inp} style={{ borderColor: "#E7DFCE" }} />
      {/* honeypot — humans never see it */}
      <input value={f.website} onChange={e => setF({ ...f, website: e.target.value })} tabIndex={-1} autoComplete="off"
        style={{ position: "absolute", left: "-9999px", height: 0, width: 0, opacity: 0 }} aria-hidden="true" />
      <button onClick={submit} disabled={state === "busy" || !f.company || !f.email || (!showName && !f.leadSource)}
        className="w-full mt-5 py-3.5 rounded-lg font-bold text-[16px] disabled:opacity-50" style={{ background: "#181818", color: "#fff" }}>
        {state === "busy" ? "…" : showName ? "Count me in" : "Talk cones with us"}
      </button>
      {state === "err" && <p className="font-mono text-[11px] mt-2" style={{ color: "#D62839" }}>{msg}</p>}
    </>
  );
}

export default function Start() {
  return (
    <main className="min-h-screen" style={{ background: "#FAF5EA" }}>
      <div className="max-w-md mx-auto px-5 py-10">
        <h1 className="font-bold text-[22px]" style={{ color: "#181818" }}>
          SESHSURE<span style={{ color: "#0D9488" }}>.</span>
        </h1>
        <p className="text-[14px] mt-1" style={{ color: "#3E3A30" }}>Wholesale pre-roll cones. Tell us a little and a human replies within one business day.</p>
        <div className="mt-5 rounded-xl border p-5 relative" style={{ background: "#fff", borderColor: "#E7DFCE" }}>
          <Suspense fallback={<p className="text-[13px]" style={{ color: "#3E3A30" }}>Loading…</p>}>
            <StartForm />
          </Suspense>
        </div>
        <p className="font-mono text-[9px] mt-6 text-center" style={{ color: "#5C574A" }}>
          VIDO MANUFACTURING AND DISTRIBUTION CORP D/B/A SESHSURE · PARKER, CO
        </p>
      </div>
    </main>
  );
}
