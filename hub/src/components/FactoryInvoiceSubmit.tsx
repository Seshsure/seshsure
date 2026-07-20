"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function FactoryInvoiceSubmit({ factoryId, runs }: { factoryId: string; runs: { id: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ ref: "", amount: "", runId: "", due: "" });
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();

  async function uploadPdf(file: File) {
    setErr("");
    const sign = await fetch("/api/uploads/sign", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ bucket: "factory-docs", filename: file.name, contentType: file.type, sizeBytes: file.size }) });
    if (!sign.ok) { setErr("Upload not authorized — PDF/JPG/PNG, 25MB"); return; }
    const { url, path } = await sign.json();
    const put = await fetch(url, { method: "PUT", headers: { "content-type": file.type }, body: file });
    if (!put.ok) { setErr("Upload failed"); return; }
    setFilePath(path); setFileName(file.name);
  }

  async function submit() {
    setBusy(true); setErr("");
    const r = await fetch("/api/factory/invoice", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ factoryId, invoiceRef: f.ref, amountUsd: parseFloat(f.amount), runId: f.runId || undefined, dueDate: f.due || undefined, storagePath: filePath ?? undefined }) });
    setBusy(false);
    if (!r.ok) { const j = await r.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Check fields"); return; }
    setOpen(false); setF({ ref: "", amount: "", runId: "", due: "" }); setFilePath(null); setFileName("");
    router.refresh();
  }

  const inp = "px-3 py-2 rounded-lg text-[13px] border-2 outline-none bg-white";
  if (!open) return (
    <button onClick={() => setOpen(true)} className="punch-sm mt-4 px-4 py-2 rounded-lg font-bold text-[12px]" style={{ background: "#181818", color: "#fff" }}>
      + Submit invoice
    </button>
  );
  return (
    <div className="punch rounded-xl bg-white p-4 mt-4">
      <p className="eyebrow" style={{ color: "#3E3A30" }}>SUBMIT INVOICE — MATCHED INVOICES PAY WITHOUT QUESTIONS</p>
      <div className="flex flex-wrap gap-2 mt-3">
        <input className={inp + " w-36"} style={{ borderColor: "#E7DFCE" }} placeholder="Invoice # *" value={f.ref} onChange={e => setF({ ...f, ref: e.target.value })} />
        <input inputMode="decimal" className={inp + " w-32"} style={{ borderColor: "#E7DFCE" }} placeholder="Amount USD *" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") })} />
        <select className={inp} style={{ borderColor: "#E7DFCE" }} value={f.runId} onChange={e => setF({ ...f, runId: e.target.value })}>
          <option value="">Link to run…</option>
          {runs.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <input type="date" className={inp} style={{ borderColor: "#E7DFCE" }} value={f.due} onChange={e => setF({ ...f, due: e.target.value })} />
      </div>
      <div className="flex items-center gap-2 mt-3">
        <label className="punch-sm px-3 py-1.5 rounded-lg font-bold text-[11px] cursor-pointer" style={{ background: filePath ? "#E7DFCE" : "#181818", color: filePath ? "#3E3A30" : "#fff" }}>
          {filePath ? "Replace PDF" : "Attach invoice PDF *"}
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) uploadPdf(file); }} />
        </label>
        {fileName && <span className="font-mono text-[10px]" style={{ color: "#0D9488" }}>✓ {fileName}</span>}
        <button onClick={submit} disabled={busy || !f.ref || !f.amount || !filePath}
          className="punch-sm ml-auto px-4 py-2 rounded-lg font-bold text-[12px] disabled:opacity-40" style={{ background: "#0D9488", color: "#fff" }}>
          {busy ? "…" : "Submit"}
        </button>
        <button onClick={() => setOpen(false)} className="font-mono text-[11px]" style={{ color: "#5C574A" }}>cancel</button>
      </div>
      {err && <p className="font-mono text-[10px] mt-2" style={{ color: "#D62839" }}>{err}</p>}
    </div>
  );
}
