"use client";
// ————— FORWARDER PROFILE — they fill everything —————
// Posts to /api/forwarder/profile (RLS-scoped to their own entity;
// banking changes freeze payments pending voice confirmation).
import { useState } from "react";
import { useRouter } from "next/navigation";

const INK = "#181818", TEAL = "#0D9488", RED = "#D62839", LINE = "#E7DFCE";
const SERVICES = ["air", "ocean", "customs", "trucking", "warehousing"] as const;

export default function ForwarderProfile() {
  const [f, setF] = useState({
    legalName: "", dba: "", address: "", opsPhone: "", afterHoursContact: "",
    scacCode: "", iataNumber: "", fmcOtiNumber: "", customsBrokerLicense: "",
    originLanes: "", insuranceCarrier: "", cargoCoverageUsd: "", wireDetails: "",
  });
  const [services, setServices] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<null | boolean>(null);
  const router = useRouter();

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const inp = "w-full rounded border-2 px-2.5 py-1.5 text-[13px] bg-white";
  const lbl = "font-mono text-[9px] font-bold tracking-wider mt-3 mb-0.5";

  async function submit() {
    setErr(""); setBusy(true);
    const res = await fetch("/api/forwarder/profile", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        legalName: f.legalName, dba: f.dba || undefined, address: f.address, opsPhone: f.opsPhone,
        afterHoursContact: f.afterHoursContact || undefined, scacCode: f.scacCode || undefined,
        iataNumber: f.iataNumber || undefined, fmcOtiNumber: f.fmcOtiNumber || undefined,
        customsBrokerLicense: f.customsBrokerLicense || undefined,
        services, originLanes: f.originLanes,
        insuranceCarrier: f.insuranceCarrier || undefined,
        cargoCoverageUsd: f.cargoCoverageUsd ? parseInt(f.cargoCoverageUsd) : undefined,
        wireDetails: f.wireDetails || undefined,
      }) });
    setBusy(false);
    const j = await res.json();
    if (!res.ok) { setErr(j.error ?? "failed"); return; }
    setDone(j.bankingFrozen);
    setTimeout(() => router.push("/freightdesk"), j.bankingFrozen ? 3500 : 1200);
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <h1 className="display text-[20px]" style={{ color: INK }}>COMPANY PROFILE</h1>
      <p className="font-mono text-[10px] mt-1" style={{ color: "#5C574A" }}>
        COMPLETE ONCE · KEEP CURRENT · BANKING CHANGES PAUSE PAYMENTS UNTIL VOICE-CONFIRMED
      </p>

      <p className={lbl} style={{ color: "#3E3A30" }}>LEGAL COMPANY NAME *</p>
      <input className={inp} style={{ borderColor: LINE }} value={f.legalName} onChange={set("legalName")} />
      <p className={lbl} style={{ color: "#3E3A30" }}>DBA (IF DIFFERENT)</p>
      <input className={inp} style={{ borderColor: LINE }} value={f.dba} onChange={set("dba")} />
      <p className={lbl} style={{ color: "#3E3A30" }}>BUSINESS ADDRESS *</p>
      <input className={inp} style={{ borderColor: LINE }} value={f.address} onChange={set("address")} />
      <div className="flex gap-2">
        <div className="grow"><p className={lbl} style={{ color: "#3E3A30" }}>OPS PHONE *</p>
          <input className={inp} style={{ borderColor: LINE }} value={f.opsPhone} onChange={set("opsPhone")} /></div>
        <div className="grow"><p className={lbl} style={{ color: "#3E3A30" }}>AFTER-HOURS CONTACT</p>
          <input className={inp} style={{ borderColor: LINE }} placeholder="name + phone" value={f.afterHoursContact} onChange={set("afterHoursContact")} /></div>
      </div>

      <p className={lbl} style={{ color: "#3E3A30" }}>SERVICES *</p>
      <div className="flex flex-wrap gap-1.5">
        {SERVICES.map(s => (
          <button key={s} onClick={() => setServices(v => v.includes(s) ? v.filter(x => x !== s) : [...v, s])}
            className="px-2.5 py-1 rounded font-mono text-[10px] font-bold uppercase"
            style={{ background: services.includes(s) ? INK : "#F4EFE3", color: services.includes(s) ? "#fff" : "#3E3A30" }}>{s}</button>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="grow"><p className={lbl} style={{ color: "#3E3A30" }}>SCAC CODE</p>
          <input className={inp} style={{ borderColor: LINE }} placeholder="e.g. NTGF" value={f.scacCode} onChange={e => setF({ ...f, scacCode: e.target.value.toUpperCase() })} /></div>
        <div className="grow"><p className={lbl} style={{ color: "#3E3A30" }}>IATA NO. (AIR)</p>
          <input className={inp} style={{ borderColor: LINE }} value={f.iataNumber} onChange={set("iataNumber")} /></div>
      </div>
      <div className="flex gap-2">
        <div className="grow"><p className={lbl} style={{ color: "#3E3A30" }}>FMC OTI NO. (OCEAN)</p>
          <input className={inp} style={{ borderColor: LINE }} value={f.fmcOtiNumber} onChange={set("fmcOtiNumber")} /></div>
        <div className="grow"><p className={lbl} style={{ color: "#3E3A30" }}>CUSTOMS BROKER LIC.</p>
          <input className={inp} style={{ borderColor: LINE }} value={f.customsBrokerLicense} onChange={set("customsBrokerLicense")} /></div>
      </div>

      <p className={lbl} style={{ color: "#3E3A30" }}>ORIGIN LANES SERVED *</p>
      <input className={inp} style={{ borderColor: LINE }} placeholder="e.g. India (DEL, BOM, INNSA, INMUN) → USA" value={f.originLanes} onChange={set("originLanes")} />

      <div className="flex gap-2">
        <div className="grow"><p className={lbl} style={{ color: "#3E3A30" }}>CARGO INSURANCE CARRIER</p>
          <input className={inp} style={{ borderColor: LINE }} value={f.insuranceCarrier} onChange={set("insuranceCarrier")} /></div>
        <div className="grow"><p className={lbl} style={{ color: "#3E3A30" }}>COVERAGE (USD)</p>
          <input className={inp} style={{ borderColor: LINE }} type="number" placeholder="e.g. 1000000" value={f.cargoCoverageUsd} onChange={set("cargoCoverageUsd")} /></div>
      </div>

      <p className={lbl} style={{ color: "#3E3A30" }}>REMITTANCE / WIRE DETAILS</p>
      <input className={inp} style={{ borderColor: LINE }} placeholder="bank, account name, routing/account or IBAN/SWIFT" value={f.wireDetails} onChange={set("wireDetails")} />
      <p className="font-mono text-[9px] mt-1" style={{ color: "#5C574A" }}>
        SUBMITTING OR CHANGING BANKING PAUSES PAYMENTS UNTIL WE CONFIRM BY PHONE — FRAUD PROTECTION FOR BOTH OF US.
      </p>

      <button onClick={submit} disabled={busy || !f.legalName || !f.address || !f.opsPhone || !f.originLanes || services.length === 0}
        className="mt-4 w-full py-2.5 rounded font-mono text-[12px] font-bold disabled:opacity-40"
        style={{ background: TEAL, color: "#fff" }}>{busy ? "…" : "SAVE PROFILE"}</button>
      {err && <p className="font-mono text-[10px] mt-2" style={{ color: RED }}>{err}</p>}
      {done !== null && (
        <p className="font-mono text-[10px] mt-2" style={{ color: TEAL }}>
          SAVED.{done ? " BANKING RECEIVED — PAYMENTS PAUSED UNTIL WE CONFIRM BY PHONE." : ""}
        </p>
      )}
    </div>
  );
}
