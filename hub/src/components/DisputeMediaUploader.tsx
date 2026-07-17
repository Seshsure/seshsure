"use client";
// Dispute evidence: photos REQUIRED, video welcome. Camera capture on mobile.
import { useState } from "react";
import { uploadDirect } from "@/lib/upload-client";

export type UploadedMedia = { path: string; kind: "photo" | "video"; name: string; sizeBytes: number };

export function DisputeMediaUploader({ onChange }: { onChange: (m: UploadedMedia[]) => void }) {
  const [items, setItems] = useState<UploadedMedia[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setBusy(true); setErr("");
    const next = [...items];
    for (const f of files) {
      const up = await uploadDirect("dispute-media", f);
      if (!up.ok) { setErr(`${f.name}: ${up.error}`); continue; }
      next.push({ path: up.path, kind: f.type.startsWith("video/") ? "video" : "photo", name: f.name, sizeBytes: f.size });
    }
    setItems(next); onChange(next); setBusy(false);
    e.target.value = "";
  }

  function remove(path: string) {
    const next = items.filter(i => i.path !== path);
    setItems(next); onChange(next);
  }

  const photos = items.filter(i => i.kind === "photo").length;

  return (
    <div className="mt-3">
      <p className="font-mono text-[9px] font-bold" style={{ color: "#6E756B" }}>
        PHOTOS &amp; VIDEO — PHOTOS REQUIRED <span style={{ color: photos ? "#0D9488" : "#B4231F" }}>({photos} PHOTO{photos === 1 ? "" : "S"})</span>
      </p>
      <p className="text-[9px] mt-0.5" style={{ color: "#9B9F98" }}>
        Shoot the defect close-up, the carton with its lot number visible, and the spread of affected units. Video of the batch behavior helps your case.
      </p>
      <div className="flex gap-2 mt-2">
        <label className="flex-1 py-3 rounded-lg border-2 border-dashed text-center text-[11px] font-bold cursor-pointer"
          style={{ borderColor: "#0D9488", color: "#0D9488" }}>
          {busy ? "Uploading…" : "📷 Photos"}
          <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={onPick} />
        </label>
        <label className="flex-1 py-3 rounded-lg border-2 border-dashed text-center text-[11px] font-bold cursor-pointer"
          style={{ borderColor: "#6E756B", color: "#6E756B" }}>
          🎥 Video (≤100MB)
          <input type="file" accept="video/mp4,video/quicktime" capture="environment" className="hidden" onChange={onPick} />
        </label>
      </div>
      {items.map(i => (
        <div key={i.path} className="flex items-center mt-1.5 px-3 py-2 rounded-lg border" style={{ borderColor: "#E4E1DA", background: "#fff" }}>
          <span className="text-[12px] mr-2">{i.kind === "video" ? "🎥" : "📷"}</span>
          <span className="flex-1 text-[10px] truncate" style={{ color: "#15181A" }}>{i.name}</span>
          <span className="font-mono text-[7px] mr-2" style={{ color: "#9B9F98" }}>{(i.sizeBytes / 1048576).toFixed(1)}MB ✓</span>
          <button onClick={() => remove(i.path)} className="font-mono text-[10px]" style={{ color: "#6E756B" }}>✕</button>
        </div>
      ))}
      {err && <p className="font-mono text-[8px] mt-1.5" style={{ color: "#B4231F" }}>{err}</p>}
    </div>
  );
}
