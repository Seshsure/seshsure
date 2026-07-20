"use client";
// ————— PACKING & PICKUP — the factory's numbers are the cargo truth —————
import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = { runId: string; current: string | null; cartons: number | null; grossKg: number | null; dims: string | null; hasList: boolean };

export function PickupDate({ runId, current, cartons, grossKg, dims, hasList }: Props) {
  const [open, setOpen] = useState(!current);
  const [f, setF] = useState({ date: current ?? "", cartons: cartons ? String(cartons) : "", grossKg: grossKg ? String(grossKg) : "", dims: dims ?? "" });
  const [listPath, setListPath] = useState<string | null>(null);
  const [listName, setListName] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [readNote, setReadNote] = useState("");
  const [err, setErr] = useState("");
  const router = useRouter();

  async function uploadList(file: File) {
    setErr("");
    const signRes = await fetch("/api/uploads/sign", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ bucket: "factory-docs", filename: file.name, contentType: file.type, sizeBytes: file.size }) });
    if (!signRes.ok) { setErr("Upload not authorized — PDF/JPG/PNG, 25MB max"); return; }
    const { url, path } = await signRes.json();
    const put = await fetch(url, { method: "PUT", headers: { "content-type": file.type }, body: file });
    if (!put.ok) { setErr("Upload failed — try again"); return; }
    setListPath(path); setListName(file.name);

    // hand the sheet to the hub — it does the typing, you confirm
    setReading(true); setReadNote("");
    const ex = await fetch("/api/factory/extract-packing", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ storagePath: path }) });
    setReading(false);
    if (ex.ok) {
      const { extracted } = await ex.json();
      setF(prev => ({ ...prev,
        cartons: extracted.cartons ? String(extracted.cartons) : prev.cartons,
        grossKg: extracted.gross_kg ? String(extracted.gross_kg) : prev.grossKg,
        dims: extracted.carton_dims ?? prev.dims }));
      setReadNote(`AUTO-READ (${String(extracted.confidence ?? "").toUpperCase()} CONFIDENCE)${extracted.notes ? ` — ${extracted.notes}` : ""} — CHECK THE NUMBERS, THEN CONFIRM`);
    } else {
      const j = await ex.json().catch(() => ({}));
      setReadNote(typeof j.error === "string" ? j.error.toUpperCase() : "AUTO-READ UNAVAILABLE — ENTER MANUALLY");
    }
  }

  async function save() {
    setBusy(true); setErr("");
    const r = await fetch("/api/factory/pickup", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId, pickupReadyDate: f.date, cartons: parseInt(f.cartons), grossKg: parseFloat(f.grossKg), dimsNote: f.dims, packingListPath: listPath ?? undefined }) });
    setBusy(false);
    if (!r.ok) { const j = await r.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Check all fields"); return; }
    setOpen(false); router.refresh();
  }

  if (current && !open) return (
    <div className="mt-2 flex items-center gap-2 flex-wrap">
      <span className="font-mono text-[11px] font-bold" style={{ color: "#0D9488" }}>
        ✓ READY {current} · {cartons} CTNS · {grossKg} KG{hasList ? " · PACKING LIST ON FILE" : ""}</span>
      <button onClick={() => setOpen(true)} className="font-mono text-[10px] font-bold underline decoration-dotted" style={{ color: "#3E3A30" }}>edit</button>
    </div>
  );

  const inp = "px-2 py-1.5 rounded border-2 font-mono text-[12px] outline-none bg-white";
  return (
    <div className="mt-2 rounded-lg border-2 p-3" style={{ borderColor: "#E7DFCE" }}>
      <p className="eyebrow" style={{ color: "#3E3A30" }}>PACKING & PICKUP — FROM YOUR PACKING SHEET</p>
      <div className="flex flex-wrap gap-2 mt-2 items-end">
        <div><label className="eyebrow block" style={{ color: "#5C574A" }}>READY DATE *</label>
          <input type="date" className={inp} style={{ borderColor: "#E7DFCE" }} value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></div>
        <div><label className="eyebrow block" style={{ color: "#5C574A" }}>CARTONS *</label>
          <input inputMode="numeric" className={inp + " w-20"} style={{ borderColor: "#E7DFCE" }} value={f.cartons} onChange={e => setF({ ...f, cartons: e.target.value.replace(/\D/g, "") })} /></div>
        <div><label className="eyebrow block" style={{ color: "#5C574A" }}>GROSS KG *</label>
          <input inputMode="decimal" className={inp + " w-24"} style={{ borderColor: "#E7DFCE" }} value={f.grossKg} onChange={e => setF({ ...f, grossKg: e.target.value.replace(/[^\d.]/g, "") })} /></div>
        <div className="grow"><label className="eyebrow block" style={{ color: "#5C574A" }}>CARTON DIMS *</label>
          <input className={inp + " w-full"} style={{ borderColor: "#E7DFCE" }} placeholder="60×40×40 cm" value={f.dims} onChange={e => setF({ ...f, dims: e.target.value })} /></div>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <label className="punch-sm px-3 py-1.5 rounded-lg font-bold text-[11px] cursor-pointer" style={{ background: listPath ? "#E7DFCE" : "#181818", color: listPath ? "#3E3A30" : "#fff" }}>
          {listPath ? "Replace packing list" : "Upload packing list (PDF)"}
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) uploadList(file); }} />
        </label>
        {listName && <span className="font-mono text-[10px]" style={{ color: "#0D9488" }}>✓ {listName}</span>}
        {reading && <span className="font-mono text-[10px]" style={{ color: "#C77800" }}>READING SHEET…</span>}
        <button onClick={save} disabled={busy || !f.date || !f.cartons || !f.grossKg || f.dims.length < 3}
          className="punch-sm ml-auto px-4 py-1.5 rounded-lg font-bold text-[12px] disabled:opacity-40" style={{ background: "#0D9488", color: "#fff" }}>
          {busy ? "…" : "Confirm ready"}
        </button>
      </div>
      {readNote && <p className="font-mono text-[10px] mt-2 font-bold" style={{ color: "#0D9488" }}>{readNote}</p>}
      <p className="font-mono text-[10px] mt-2" style={{ color: "#5C574A" }}>SESHSURE ARRANGES PICKUP FROM THESE FIGURES — THEY MUST MATCH THE PHYSICAL PACKING SHEET.</p>
      {err && <p className="font-mono text-[10px] mt-1" style={{ color: "#D62839" }}>{err}</p>}
    </div>
  );
}
