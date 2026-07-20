"use client";
// ————— SHIPPING DOCS — the transit paper trail, owner-side —————
import { useState } from "react";
import { useRouter } from "next/navigation";

const DOCS: [string, string][] = [
  ["bol_awb", "Bill of Lading / Air Waybill"],
  ["isf_proof", "ISF Filing Confirmation"],
  ["entry_7501", "Customs Entry (CBP 7501)"],
  ["duty_receipt", "Duty Payment Receipt"],
  ["arrival_notice", "Arrival Notice / Delivery Order"],
  ["pod", "Proof of Delivery"],
];

type Doc = { doc_type: string; filename: string };

export function ShipDocs({ runId, existing }: { runId: string; existing: Doc[] }) {
  const [open, setOpen] = useState(false);
  const [busyType, setBusyType] = useState("");
  const [err, setErr] = useState("");
  const router = useRouter();
  const have = new Map(existing.map(d => [d.doc_type, d.filename]));
  const count = DOCS.filter(([k]) => have.has(k)).length;

  async function upload(docType: string, file: File) {
    setErr(""); setBusyType(docType);
    const sign = await fetch("/api/uploads/sign", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ bucket: "factory-docs", filename: file.name, contentType: file.type, sizeBytes: file.size }) });
    if (!sign.ok) { setErr("PDF/JPG/PNG, 25MB max"); setBusyType(""); return; }
    const { url, path } = await sign.json();
    const put = await fetch(url, { method: "PUT", headers: { "content-type": file.type }, body: file });
    if (!put.ok) { setErr("Upload failed"); setBusyType(""); return; }
    const rec = await fetch("/api/factory/run-doc", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId, docType, filename: file.name, storagePath: path }) });
    setBusyType("");
    if (!rec.ok) { setErr("Couldn't record"); return; }
    router.refresh();
  }

  return (
    <div className="mt-1">
      <button onClick={() => setOpen(!open)} className="font-mono text-[11px] font-bold" style={{ color: count >= 3 ? "#0D9488" : "#3E3A30" }}>
        SHIPPING DOCS {count}/6 {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="mt-2 rounded-lg border-2 p-3 bg-white" style={{ borderColor: "#E7DFCE" }}>
          {DOCS.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-3 py-1.5 border-b last:border-0" style={{ borderColor: "#E7DFCE" }}>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold" style={{ color: "#181818" }}>{label}</p>
                {have.has(key) && <p className="font-mono text-[9px] truncate" style={{ color: "#0D9488" }}>✓ {have.get(key)}</p>}
              </div>
              <label className="shrink-0 px-2.5 py-1 rounded font-mono text-[10px] font-bold cursor-pointer"
                style={{ background: have.has(key) ? "#E7DFCE" : "#181818", color: have.has(key) ? "#3E3A30" : "#fff" }}>
                {busyType === key ? "…" : have.has(key) ? "Replace" : "Upload"}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(key, f); }} />
              </label>
            </div>
          ))}
          {err && <p className="font-mono text-[10px] mt-1" style={{ color: "#D62839" }}>{err}</p>}
        </div>
      )}
    </div>
  );
}
