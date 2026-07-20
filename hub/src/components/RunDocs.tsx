"use client";
// ————— EXPORT DOCUMENT RAIL — per shipment, factory-uploaded —————
import { useState } from "react";
import { useRouter } from "next/navigation";

const DOCS: [string, string, string][] = [
  ["commercial_invoice", "Commercial Invoice", "Values must match the actual transaction; state Incoterms + currency"],
  ["packing_list", "Packing List", "Auto-read fills the cargo sheet"],
  ["certificate_of_origin", "Certificate of Origin", "Substantiates India origin for tariff purposes"],
  ["vgm", "VGM Certificate", "Verified Gross Mass — required before vessel loading (SOLAS)"],
  ["ispm15", "ISPM-15 Pallet Cert", "ONLY if palletized — heat-treatment stamp; floor-loaded cartons skip this"],
  ["coa", "Certificates of Analysis", "Per-lot CoAs for the compliance file"],
];

type Doc = { doc_type: string; filename: string };

export function RunDocs({ runId, existing }: { runId: string; existing: Doc[] }) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [busyType, setBusyType] = useState("");
  const router = useRouter();
  const have = new Map(existing.map(d => [d.doc_type, d.filename]));
  const count = DOCS.filter(([k]) => have.has(k)).length;

  async function upload(docType: string, file: File) {
    setErr(""); setBusyType(docType);
    const signRes = await fetch("/api/uploads/sign", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ bucket: "factory-docs", filename: file.name, contentType: file.type, sizeBytes: file.size }) });
    if (!signRes.ok) { setErr("Not authorized — PDF/JPG/PNG, 25MB"); setBusyType(""); return; }
    const { url, path } = await signRes.json();
    const put = await fetch(url, { method: "PUT", headers: { "content-type": file.type }, body: file });
    if (!put.ok) { setErr("Upload failed"); setBusyType(""); return; }
    const rec = await fetch("/api/factory/run-doc", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId, docType, filename: file.name, storagePath: path }) });
    setBusyType("");
    if (!rec.ok) { setErr("Couldn't record document"); return; }
    router.refresh();
  }

  return (
    <div className="mt-2">
      <button onClick={() => setOpen(!open)} className="font-mono text-[11px] font-bold"
        style={{ color: count >= 4 ? "#0D9488" : "#C77800" }}>
        EXPORT DOCS {count}/6 {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="mt-2 rounded-lg border-2 p-3" style={{ borderColor: "#E7DFCE" }}>
          {DOCS.map(([key, label, hint]) => (
            <div key={key} className="flex items-center justify-between gap-3 py-2 border-b last:border-0" style={{ borderColor: "#E7DFCE" }}>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold" style={{ color: "#181818" }}>{label}</p>
                <p className="font-mono text-[9px]" style={{ color: have.has(key) ? "#0D9488" : "#5C574A" }}>
                  {have.has(key) ? `✓ ${have.get(key)}` : hint}</p>
              </div>
              <label className="shrink-0 px-2.5 py-1.5 rounded font-mono text-[10px] font-bold cursor-pointer"
                style={{ background: have.has(key) ? "#E7DFCE" : "#181818", color: have.has(key) ? "#3E3A30" : "#fff" }}>
                {busyType === key ? "…" : have.has(key) ? "Replace" : "Upload"}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) upload(key, f); }} />
              </label>
            </div>
          ))}
          {err && <p className="font-mono text-[10px] mt-2" style={{ color: "#D62839" }}>{err}</p>}
        </div>
      )}
    </div>
  );
}
