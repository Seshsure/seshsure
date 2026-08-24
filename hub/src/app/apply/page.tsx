"use client";
// ————— PUBLIC APPLY PAGE — the shareable front door —————
// Put hub.seshsure.com/apply on anything: QR at a booth, a DM, the website
// button. ?ref=CODE attributes the campaign. Applying is open; access only
// arrives after owner approval, via the invite email.
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

const INK = "#181818", TEAL = "#13A89E", LINE = "#E7DFCE", PAPER = "#FAF5EA";

function ApplyForm() {
  const ref = useSearchParams().get("ref") ?? undefined;
  const [f, setF] = useState({ company: "", contactName: "", email: "", phone: "", website: "", state: "", licenseNo: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function submit() {
    setBusy(true);
    await fetch("/api/public/apply", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...f, ref }) }).catch(() => {});
    setBusy(false); setDone(true);
  }

  if (done) return (
    <div className="text-center py-10">
      <p className="display text-[22px]" style={{ color: INK }}>APPLICATION IN.</p>
      <p className="text-[14px] mt-2" style={{ color: "#3E3A30" }}>
        We review every application by hand. If it&apos;s a fit, your invite lands in your inbox — usually within one business day.
      </p>
    </div>
  );

  const inp = "w-full rounded border-2 px-3 py-2 text-[14px] bg-white";
  const lab = "font-mono text-[9px] font-bold tracking-wider mt-3 mb-1";
  return (
    <>
      <p className={lab} style={{ color: "#3E3A30" }}>COMPANY *</p>
      <input className={inp} style={{ borderColor: LINE }} value={f.company} onChange={set("company")} placeholder="Your brand or distro" />
      <div className="flex gap-2">
        <div className="grow"><p className={lab} style={{ color: "#3E3A30" }}>YOUR NAME *</p>
          <input className={inp} style={{ borderColor: LINE }} value={f.contactName} onChange={set("contactName")} /></div>
        <div className="grow"><p className={lab} style={{ color: "#3E3A30" }}>STATE</p>
          <input className={inp} style={{ borderColor: LINE }} value={f.state} onChange={set("state")} placeholder="CO" /></div>
      </div>
      <p className={lab} style={{ color: "#3E3A30" }}>WORK EMAIL *</p>
      <input className={inp} style={{ borderColor: LINE }} type="email" value={f.email} onChange={set("email")} placeholder="you@company.com" />
      <div className="flex gap-2">
        <div className="grow"><p className={lab} style={{ color: "#3E3A30" }}>PHONE</p>
          <input className={inp} style={{ borderColor: LINE }} value={f.phone} onChange={set("phone")} /></div>
        <div className="grow"><p className={lab} style={{ color: "#3E3A30" }}>WEBSITE</p>
          <input className={inp} style={{ borderColor: LINE }} value={f.website} onChange={set("website")} placeholder="company.com" /></div>
      </div>
      <p className={lab} style={{ color: "#3E3A30" }}>LICENSE / RESALE CERT # (SPEEDS UP APPROVAL)</p>
      <input className={inp} style={{ borderColor: LINE }} value={f.licenseNo} onChange={set("licenseNo")} />
      <p className={lab} style={{ color: "#3E3A30" }}>WHAT ARE YOU LOOKING FOR?</p>
      <textarea className={inp} style={{ borderColor: LINE }} rows={3} value={f.message} onChange={set("message")}
        placeholder="Monthly volume, branded vs unbranded, timeline…" />
      {/* honeypot — humans never see it */}
      <input type="text" name="fax" tabIndex={-1} autoComplete="off" style={{ position: "absolute", left: "-9999px" }} aria-hidden="true" />
      <button onClick={submit} disabled={busy || f.company.length < 2 || f.contactName.length < 2 || !f.email.includes("@")}
        className="mt-4 w-full py-3 rounded font-mono text-[13px] font-bold tracking-wider disabled:opacity-40"
        style={{ background: INK, color: "#FFFDF6", boxShadow: `4px 4px 0 ${TEAL}` }}>
        {busy ? "…" : "REQUEST ACCESS →"}
      </button>
      <p className="font-mono text-[9px] mt-3 text-center" style={{ color: "#8B857A" }}>
        VERIFIED WHOLESALE ACCOUNTS ONLY · WE REVIEW EVERY APPLICATION · <a href="/privacy" style={{ color: "#8B857A" }}>PRIVACY</a> · <a href="/terms" style={{ color: "#8B857A" }}>TERMS</a>
      </p>
    </>
  );
}

export default function Apply() {
  return (
    <main className="min-h-screen" style={{ background: PAPER }}>
      <div className="max-w-md mx-auto px-5 py-10">
        <p className="display text-[20px]" style={{ color: INK }}>SESHSURE<span style={{ color: TEAL }}> HUB</span></p>
        <h1 className="display text-[26px] mt-4 leading-tight" style={{ color: INK }}>WHOLESALE ACCESS</h1>
        <p className="text-[14px] mt-1" style={{ color: "#3E3A30" }}>
          Patented peel-fresh cones. Puff. Peel. Pass.™ — apply for a verified wholesale account.
        </p>
        <div className="mt-2">
          <Suspense><ApplyForm /></Suspense>
        </div>
      </div>
    </main>
  );
}
