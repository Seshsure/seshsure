"use client";
// ————— EVIDENCE PHOTOS — camera to record in two taps —————
// One component for every custody role: forwarder attaches POD/damage to
// shipments, factory attaches QC to runs, owner sees everything. Mobile
// camera capture native via the file input.
import { useEffect, useState, useCallback } from "react";
import { uploadDirect } from "@/lib/upload-client";

const INK = "#181818", TEAL = "#0D9488", RED = "#D62839", LINE = "#E7DFCE";

type Photo = { id: string; kind: string; caption: string | null; at: string; url: string | null };

export function EvidencePhotos({ entityTable, entityId, kind, canUpload, label }: {
  entityTable: "shipments" | "production_runs"; entityId: string;
  kind: "pod" | "qc" | "damage"; canUpload: boolean; label: string;
}) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/evidence?table=${entityTable}&id=${entityId}`);
    if (res.ok) setPhotos((await res.json()).photos ?? []);
  }, [entityTable, entityId]);
  useEffect(() => { load(); }, [load]);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setErr(""); setBusy(true);
    const up = await uploadDirect("evidence", file);
    if (!up.ok) { setErr(up.error); setBusy(false); return; }
    const res = await fetch("/api/evidence", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, entityTable, entityId, storagePath: up.path }) });
    setBusy(false);
    if (!res.ok) { setErr((await res.json()).error ?? "failed"); return; }
    load();
  }

  if (!canUpload && photos.length === 0) return null;
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[9px] font-bold" style={{ color: "#5C574A" }}>{label} ({photos.length})</p>
        {canUpload && (
          <label className="px-2.5 py-1 rounded font-mono text-[9px] font-bold cursor-pointer"
            style={{ background: busy ? "#F4EFE3" : INK, color: busy ? "#8B857A" : "#fff" }}>
            {busy ? "UPLOADING…" : "📷 ADD PHOTO"}
            <input type="file" className="hidden" accept="image/*" capture="environment" onChange={pick} disabled={busy} />
          </label>
        )}
      </div>
      {photos.length > 0 && (
        <div className="flex gap-1.5 mt-1.5 overflow-x-auto pb-1">
          {photos.map(p => p.url && (
            <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.kind} className="h-16 w-16 object-cover rounded border-2" style={{ borderColor: p.kind === "damage" ? RED : LINE }} />
            </a>
          ))}
        </div>
      )}
      {err && <p className="font-mono text-[9px] mt-1" style={{ color: RED }}>{err}</p>}
      {canUpload && photos.length === 0 && !busy && (
        <p className="font-mono text-[9px] mt-1" style={{ color: TEAL }}>PHOTOS ARE EVIDENCE — THEY PROTECT YOU IN ANY DISPUTE</p>
      )}
    </div>
  );
}
