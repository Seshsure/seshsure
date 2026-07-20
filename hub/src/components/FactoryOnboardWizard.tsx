"use client";
// ————— FACTORY ONBOARDING — the complete file, factory-entered —————
// Company → Banking → Documents → Agreements → Spec ack.
// SeshSure assumes nothing; the factory states who they are, with evidence.
import { useState } from "react";
import { useRouter } from "next/navigation";

type Spec = { id: string; title: string; version: number };
type Props = { factoryId: string; termsDone: boolean; specDone: boolean; docKeys: string[]; specs: Spec[]; companyDone: boolean; bankingDone: boolean; docsCount: number };

const DOC_TYPES: [string, string, boolean][] = [
  ["registration", "Company registration / incorporation certificate", true],
  ["tax_cert", "Tax registration (GST / VAT certificate)", true],
  ["iec", "Import-Export Code (IEC) certificate", true],
  ["bank_letter", "Bank letter or cancelled cheque (account proof)", true],
  ["quality_cert", "Quality certifications (ISO / BRC / FSC…)", false],
  ["food_contact", "Food-contact / material compliance docs", false],
];

const inp = "w-full mt-1 px-3 py-2.5 rounded-lg text-[14px] border-2 outline-none bg-white";
const lbl = "eyebrow block mt-3";
const lblC = { color: "#5C574A" };
const bdr = { borderColor: "#E7DFCE" };

export function FactoryOnboardWizard(p: Props) {
  const steps = ["company", "banking", "documents", "agreements", "spec"] as const;
  const firstIncomplete = !p.companyDone ? 0 : !p.bankingDone ? 1 : p.docsCount < 4 ? 2 : !p.termsDone ? 3 : !p.specDone ? 4 : 5;
  const [step, setStep] = useState(Math.min(firstIncomplete, 4));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();

  const [co, setCo] = useState({ legalName: "", addressLine1: "", addressLine2: "", city: "", region: "", postalCode: "", country: "", registrationNo: "", taxId: "", panNo: "", iecCode: "", contactName: "", contactEmail: "", contactPhone: "", contactWhatsapp: "" });
  const [bk, setBk] = useState({ beneficiaryName: "", bankName: "", branchAddress: "", accountNumber: "", swift: "", ifsc: "" });
  const [cap, setCap] = useState({ monthlyCapacityUnits: "", moqUnits: "", leadTimeDays: "" });
  const [sig, setSig] = useState({ signerName: "", signerTitle: "" });
  const [uploaded, setUploaded] = useState<Record<string, string>>({});

  async function post(body: Record<string, unknown>) {
    setBusy(true); setErr("");
    const r = await fetch("/api/factory-onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!r.ok) { const j = await r.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Check the required fields"); return false; }
    return true;
  }

  async function uploadDoc(docType: string, file: File) {
    setErr("");
    const signRes = await fetch("/api/uploads/sign", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ bucket: "factory-docs", filename: file.name, contentType: file.type, sizeBytes: file.size }) });
    if (!signRes.ok) { setErr("Upload not authorized — check file type (PDF/JPG/PNG) and size (25MB max)"); return; }
    const { url, path } = await signRes.json();
    const put = await fetch(url, { method: "PUT", headers: { "content-type": file.type }, body: file });
    if (!put.ok) { setErr("Upload failed — try again"); return; }
    const ok = await post({ step: "doc_record", factoryId: p.factoryId, docType, filename: file.name, storagePath: path });
    if (ok) setUploaded(u => ({ ...u, [docType]: file.name }));
  }

  const StepDot = ({ i, label }: { i: number; label: string }) => (
    <button onClick={() => setStep(i)} className="flex items-center gap-1.5">
      <span className="w-5 h-5 rounded-full font-mono text-[10px] font-bold flex items-center justify-center border-2"
        style={i < firstIncomplete ? { background: "#0D9488", color: "#fff", borderColor: "#0D9488" }
          : i === step ? { background: "#181818", color: "#fff", borderColor: "#181818" }
          : { borderColor: "#E7DFCE", color: "#5C574A" }}>{i < firstIncomplete ? "✓" : i + 1}</span>
      <span className="font-mono text-[10px] font-bold hidden sm:inline" style={{ color: i === step ? "#181818" : "#5C574A" }}>{label}</span>
    </button>
  );

  if (firstIncomplete >= 5) return (
    <div className="punch rounded-xl bg-white p-6 mt-5 text-center">
      <p className="text-[16px] font-bold" style={{ color: "#0D9488" }}>✓ Onboarding complete</p>
      <p className="text-[13px] mt-1" style={{ color: "#3E3A30" }}>SeshSure will confirm rates and payment terms with you directly. The Run Board is open.</p>
    </div>
  );

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-3">{steps.map((sname, i) => <StepDot key={sname} i={i} label={sname.toUpperCase()} />)}</div>

      {step === 0 && (
        <div className="punch rounded-xl bg-white p-5 mt-4">
          <p className="eyebrow" style={{ color: "#3E3A30" }}>COMPANY — WHO YOU ARE</p>
          <label className={lbl} style={lblC}>LEGAL NAME *</label>
          <input className={inp} style={bdr} value={co.legalName} onChange={e => setCo({ ...co, legalName: e.target.value })} />
          <label className={lbl} style={lblC}>ADDRESS LINE 1 *</label>
          <input className={inp} style={bdr} value={co.addressLine1} onChange={e => setCo({ ...co, addressLine1: e.target.value })} />
          <label className={lbl} style={lblC}>ADDRESS LINE 2</label>
          <input className={inp} style={bdr} value={co.addressLine2} onChange={e => setCo({ ...co, addressLine2: e.target.value })} />
          <div className="grid grid-cols-3 gap-3">
            <div><label className={lbl} style={lblC}>CITY *</label><input className={inp} style={bdr} value={co.city} onChange={e => setCo({ ...co, city: e.target.value })} /></div>
            <div><label className={lbl} style={lblC}>STATE/REGION</label><input className={inp} style={bdr} value={co.region} onChange={e => setCo({ ...co, region: e.target.value })} /></div>
            <div><label className={lbl} style={lblC}>POSTAL CODE</label><input className={inp} style={bdr} value={co.postalCode} onChange={e => setCo({ ...co, postalCode: e.target.value })} /></div>
          </div>
          <label className={lbl} style={lblC}>COUNTRY *</label>
          <input className={inp} style={bdr} value={co.country} onChange={e => setCo({ ...co, country: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl} style={lblC}>COMPANY REGISTRATION / CIN</label><input className={inp} style={bdr} value={co.registrationNo} onChange={e => setCo({ ...co, registrationNo: e.target.value })} /></div>
            <div><label className={lbl} style={lblC}>TAX ID (GSTIN / VAT)</label><input className={inp} style={bdr} value={co.taxId} onChange={e => setCo({ ...co, taxId: e.target.value })} /></div>
            <div><label className={lbl} style={lblC}>PAN</label><input className={inp} style={bdr} value={co.panNo} onChange={e => setCo({ ...co, panNo: e.target.value })} /></div>
            <div><label className={lbl} style={lblC}>IMPORT-EXPORT CODE (IEC)</label><input className={inp} style={bdr} value={co.iecCode} onChange={e => setCo({ ...co, iecCode: e.target.value })} /></div>
          </div>
          <p className="eyebrow mt-5" style={{ color: "#3E3A30" }}>PRIMARY CONTACT</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl} style={lblC}>NAME *</label><input className={inp} style={bdr} value={co.contactName} onChange={e => setCo({ ...co, contactName: e.target.value })} /></div>
            <div><label className={lbl} style={lblC}>EMAIL *</label><input className={inp} style={bdr} value={co.contactEmail} onChange={e => setCo({ ...co, contactEmail: e.target.value })} /></div>
            <div><label className={lbl} style={lblC}>PHONE *</label><input className={inp} style={bdr} value={co.contactPhone} onChange={e => setCo({ ...co, contactPhone: e.target.value })} /></div>
            <div><label className={lbl} style={lblC}>WHATSAPP</label><input className={inp} style={bdr} value={co.contactWhatsapp} onChange={e => setCo({ ...co, contactWhatsapp: e.target.value })} /></div>
          </div>
          <button disabled={busy} onClick={async () => { if (await post({ step: "company", factoryId: p.factoryId, ...co, addressLine2: co.addressLine2 || undefined, region: co.region || undefined, postalCode: co.postalCode || undefined, registrationNo: co.registrationNo || undefined, taxId: co.taxId || undefined, panNo: co.panNo || undefined, iecCode: co.iecCode || undefined, contactWhatsapp: co.contactWhatsapp || undefined })) { setStep(1); router.refresh(); } }}
            className="punch-sm w-full mt-5 py-3 rounded-lg font-bold text-[14px]" style={{ background: "#0D9488", color: "#fff" }}>{busy ? "Saving…" : "Save & continue"}</button>
        </div>
      )}

      {step === 1 && (
        <div className="punch rounded-xl bg-white p-5 mt-4">
          <p className="eyebrow" style={{ color: "#3E3A30" }}>BANKING — WHERE WE WIRE</p>
          <label className={lbl} style={lblC}>BENEFICIARY NAME *</label>
          <input className={inp} style={bdr} value={bk.beneficiaryName} onChange={e => setBk({ ...bk, beneficiaryName: e.target.value })} />
          <label className={lbl} style={lblC}>BANK NAME *</label>
          <input className={inp} style={bdr} value={bk.bankName} onChange={e => setBk({ ...bk, bankName: e.target.value })} />
          <label className={lbl} style={lblC}>BRANCH ADDRESS *</label>
          <input className={inp} style={bdr} value={bk.branchAddress} onChange={e => setBk({ ...bk, branchAddress: e.target.value })} />
          <div className="grid grid-cols-3 gap-3">
            <div><label className={lbl} style={lblC}>ACCOUNT NO *</label><input className={inp} style={bdr} value={bk.accountNumber} onChange={e => setBk({ ...bk, accountNumber: e.target.value })} /></div>
            <div><label className={lbl} style={lblC}>SWIFT *</label><input className={inp} style={bdr} value={bk.swift} onChange={e => setBk({ ...bk, swift: e.target.value.toUpperCase() })} /></div>
            <div><label className={lbl} style={lblC}>IFSC</label><input className={inp} style={bdr} value={bk.ifsc} onChange={e => setBk({ ...bk, ifsc: e.target.value.toUpperCase() })} /></div>
          </div>
          <p className="font-mono text-[10px] mt-3 leading-relaxed" style={{ color: "#5C574A" }}>
            SECURITY: ANY FUTURE CHANGE TO THESE DETAILS FREEZES PAYMENTS UNTIL VERIFIED BY VOICE WITH SESHSURE. THIS PROTECTS YOUR MONEY AS MUCH AS OURS.
          </p>
          <button disabled={busy} onClick={async () => { if (await post({ step: "banking", factoryId: p.factoryId, ...bk, ifsc: bk.ifsc || undefined })) { setStep(2); router.refresh(); } }}
            className="punch-sm w-full mt-4 py-3 rounded-lg font-bold text-[14px]" style={{ background: "#0D9488", color: "#fff" }}>{busy ? "Saving…" : "Save & continue"}</button>
        </div>
      )}

      {step === 2 && (
        <div className="punch rounded-xl bg-white p-5 mt-4">
          <p className="eyebrow" style={{ color: "#3E3A30" }}>DOCUMENTS — THE EVIDENCE FILE</p>
          <p className="text-[12px] mt-1" style={{ color: "#3E3A30" }}>PDF, JPG, or PNG. Required items marked *.</p>
          {DOC_TYPES.map(([key, label, required]) => (
            <div key={key} className="flex items-center justify-between gap-3 mt-3 pb-3 border-b" style={bdr}>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold" style={{ color: "#181818" }}>{label}{required ? " *" : ""}</p>
                {uploaded[key] && <p className="font-mono text-[10px] truncate" style={{ color: "#0D9488" }}>✓ {uploaded[key]}</p>}
              </div>
              <label className="punch-sm shrink-0 px-3 py-2 rounded-lg font-bold text-[12px] cursor-pointer" style={{ background: uploaded[key] ? "#E7DFCE" : "#181818", color: uploaded[key] ? "#3E3A30" : "#fff" }}>
                {uploaded[key] ? "Replace" : "Upload"}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadDoc(key, f); }} />
              </label>
            </div>
          ))}
          <p className="eyebrow mt-5" style={{ color: "#3E3A30" }}>PRODUCTION PROFILE</p>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={lbl} style={lblC}>CAPACITY / MONTH *</label><input inputMode="numeric" className={inp} style={bdr} value={cap.monthlyCapacityUnits} onChange={e => setCap({ ...cap, monthlyCapacityUnits: e.target.value.replace(/\D/g, "") })} /></div>
            <div><label className={lbl} style={lblC}>MOQ (UNITS) *</label><input inputMode="numeric" className={inp} style={bdr} value={cap.moqUnits} onChange={e => setCap({ ...cap, moqUnits: e.target.value.replace(/\D/g, "") })} /></div>
            <div><label className={lbl} style={lblC}>LEAD TIME (DAYS) *</label><input inputMode="numeric" className={inp} style={bdr} value={cap.leadTimeDays} onChange={e => setCap({ ...cap, leadTimeDays: e.target.value.replace(/\D/g, "") })} /></div>
          </div>
          <button disabled={busy || Object.keys(uploaded).filter(k => DOC_TYPES.find(d => d[0] === k && d[2])).length + p.docsCount < 4 || !cap.monthlyCapacityUnits || !cap.moqUnits || !cap.leadTimeDays}
            onClick={async () => { if (await post({ step: "capabilities", factoryId: p.factoryId, monthlyCapacityUnits: parseInt(cap.monthlyCapacityUnits), moqUnits: parseInt(cap.moqUnits), leadTimeDays: parseInt(cap.leadTimeDays) })) { setStep(3); router.refresh(); } }}
            className="punch-sm w-full mt-5 py-3 rounded-lg font-bold text-[14px] disabled:opacity-50" style={{ background: "#0D9488", color: "#fff" }}>{busy ? "Saving…" : "Save & continue"}</button>
        </div>
      )}

      {step === 3 && (
        <div className="punch rounded-xl bg-white p-5 mt-4">
          <p className="eyebrow" style={{ color: "#3E3A30" }}>AGREEMENTS — SIGN TO PROCEED</p>
          <p className="text-[12px] mt-1" style={{ color: "#3E3A30" }}>NDA & IP protection · Non-circumvention · Manufacturing & supply terms. Full text available on each agreement page in this portal.</p>
          <label className={lbl} style={lblC}>SIGNER FULL NAME *</label>
          <input className={inp} style={bdr} value={sig.signerName} onChange={e => setSig({ ...sig, signerName: e.target.value })} />
          <label className={lbl} style={lblC}>TITLE *</label>
          <input className={inp} style={bdr} value={sig.signerTitle} onChange={e => setSig({ ...sig, signerTitle: e.target.value })} />
          <p className="font-mono text-[10px] mt-3" style={{ color: "#5C574A" }}>SIGNING RECORDS NAME, TITLE, TIMESTAMP, IP ADDRESS, AND DEVICE.</p>
          <button disabled={busy || sig.signerName.length < 3 || sig.signerTitle.length < 2}
            onClick={async () => { if (await post({ step: "terms", factoryId: p.factoryId, signerName: sig.signerName, signerTitle: sig.signerTitle, acceptedDocKeys: p.docKeys })) { setStep(4); router.refresh(); } }}
            className="punch-sm w-full mt-4 py-3 rounded-lg font-bold text-[14px] disabled:opacity-50" style={{ background: "#181818", color: "#fff" }}>{busy ? "Signing…" : "Sign all three agreements"}</button>
        </div>
      )}

      {step === 4 && (
        <div className="punch rounded-xl bg-white p-5 mt-4">
          <p className="eyebrow" style={{ color: "#3E3A30" }}>SPECIFICATIONS — ACKNOWLEDGE</p>
          {p.specs.length === 0 ? (
            <p className="text-[13px] mt-2" style={{ color: "#3E3A30" }}>No specifications published yet — SeshSure will issue them; you&apos;ll acknowledge before first production.</p>
          ) : p.specs.map(sp => (
            <p key={sp.id} className="text-[13px] mt-2 font-semibold" style={{ color: "#181818" }}>{sp.title} — v{sp.version}</p>
          ))}
          <button disabled={busy} onClick={async () => {
            if (p.specs.length === 0) { router.refresh(); return; }
            if (await post({ step: "spec_ack", factoryId: p.factoryId, specVersionIds: p.specs.map(x => x.id) })) router.refresh();
          }} className="punch-sm w-full mt-4 py-3 rounded-lg font-bold text-[14px]" style={{ background: "#0D9488", color: "#fff" }}>
            {busy ? "…" : p.specs.length === 0 ? "Finish" : "Acknowledge & finish"}</button>
        </div>
      )}

      {err && <p className="font-mono text-[11px] mt-3" style={{ color: "#D62839" }}>{err}</p>}
    </div>
  );
}
