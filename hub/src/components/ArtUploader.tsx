"use client";
// Branded-cone art: upload → instant wrap mockup + honest print-readiness verdict.
// The mockup is a DIGITAL PREVIEW inside the client's own portal — never marketing
// output — and is labeled as such. The binding artifact remains the press proof.
import { useRef, useState } from "react";
import { uploadDirect } from "@/lib/upload-client";

export function ArtUploader({ onRegistered }: { onRegistered?: (id: string) => void }) {
  const [state, setState] = useState<"idle"|"busy"|"done"|"err">("idle");
  const [msg, setMsg] = useState("");
  const [verdict, setVerdict] = useState<{ ready: boolean; notes: string } | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  function drawMockup(img: HTMLImageElement) {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d")!; const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    // paper cone silhouette (schematic, not product imagery)
    const topW = 74, botW = 30, cx = W / 2, top = 18, bot = H - 30;
    ctx.beginPath();
    ctx.moveTo(cx - topW / 2, top); ctx.lineTo(cx + topW / 2, top);
    ctx.lineTo(cx + botW / 2, bot); ctx.lineTo(cx - botW / 2, bot); ctx.closePath();
    ctx.fillStyle = "#F7F3E9"; ctx.fill(); ctx.strokeStyle = "#D9D2C2"; ctx.lineWidth = 1; ctx.stroke();
    // wrap band on the crutch region: clip trapezoid, draw art with taper
    const bandTop = bot - 64, bandBot = bot - 6;
    const wAt = (y: number) => topW + (botW - topW) * ((y - top) / (bot - top));
    ctx.save(); ctx.beginPath();
    ctx.moveTo(cx - wAt(bandTop) / 2, bandTop); ctx.lineTo(cx + wAt(bandTop) / 2, bandTop);
    ctx.lineTo(cx + wAt(bandBot) / 2, bandBot); ctx.lineTo(cx - wAt(bandBot) / 2, bandBot);
    ctx.closePath(); ctx.clip();
    const slices = 40;
    for (let i = 0; i < slices; i++) {
      const y0 = bandTop + (bandBot - bandTop) * (i / slices);
      const y1 = bandTop + (bandBot - bandTop) * ((i + 1) / slices);
      const w0 = wAt(y0);
      ctx.drawImage(img, 0, (img.height * i) / slices, img.width, img.height / slices,
        cx - w0 / 2, y0, w0, y1 - y0 + 0.5);
    }
    ctx.restore();
    // subtle cylindrical shading
    const g = ctx.createLinearGradient(cx - topW / 2, 0, cx + topW / 2, 0);
    g.addColorStop(0, "rgba(0,0,0,.14)"); g.addColorStop(.2, "rgba(0,0,0,0)");
    g.addColorStop(.8, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.14)");
    ctx.save(); ctx.beginPath();
    ctx.moveTo(cx - topW / 2, top); ctx.lineTo(cx + topW / 2, top);
    ctx.lineTo(cx + botW / 2, bot); ctx.lineTo(cx - botW / 2, bot); ctx.closePath();
    ctx.clip(); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setState("busy"); setMsg(""); setVerdict(null);

    // local dims + preview (raster only)
    let widthPx: number | undefined, heightPx: number | undefined;
    if (file.type.startsWith("image/") && file.type !== "image/svg+xml") {
      const url = URL.createObjectURL(file); setImgUrl(url);
      const img = new Image();
      await new Promise<void>(res => { img.onload = () => res(); img.src = url; });
      widthPx = img.naturalWidth; heightPx = img.naturalHeight;
      setTimeout(() => drawMockup(img), 30);
    }

    const up = await uploadDirect("art", file);
    if (!up.ok) { setState("err"); setMsg(up.error); return; }

    const reg = await fetch("/api/art", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ storagePath: up.path, fileType: file.type, widthPx, heightPx, label: file.name }) });
    const j = await reg.json();
    if (!reg.ok) { setState("err"); setMsg(j.error ?? "register failed"); return; }
    setVerdict({ ready: j.printReady, notes: j.notes });
    setState("done");
    onRegistered?.(j.artAssetId);
  }

  return (
    <div className="rounded-xl border p-4 mt-3" style={{ background: "#fff", borderColor: "#E7DFCE" }}>
      <p className="font-mono text-[9px] font-bold" style={{ color: "#514C41" }}>BRAND ARTWORK — WRAP PREVIEW</p>
      <label className="block mt-2 py-3 rounded-lg border-2 border-dashed text-center text-[11px] font-bold cursor-pointer"
        style={{ borderColor: "#0D9488", color: "#0D9488" }}>
        {state === "busy" ? "Uploading…" : "Upload art (PNG · JPG · SVG · PDF, ≤50MB)"}
        <input type="file" accept="image/png,image/jpeg,image/svg+xml,application/pdf" className="hidden" onChange={onPick} />
      </label>
      {imgUrl && (
        <div className="flex gap-3 mt-3 items-start">
          <canvas ref={canvasRef} width={150} height={210} className="rounded-lg border" style={{ borderColor: "#E7DFCE", background: "#FBF9F4" }} />
          <div className="flex-1">
            {verdict && (
              <>
                <p className="font-mono text-[9px] font-bold" style={{ color: verdict.ready ? "#0D9488" : "#B07A1F" }}>
                  {verdict.ready ? "✓ PRESS-RESOLUTION OK" : "⚠ PREVIEW-ONLY RESOLUTION"}
                </p>
                <p className="text-[9px] mt-1 leading-relaxed" style={{ color: "#514C41" }}>{verdict.notes}</p>
              </>
            )}
            <p className="font-mono text-[7px] mt-2 leading-relaxed" style={{ color: "#7A7365" }}>
              DIGITAL PREVIEW ONLY — NOT A PRINT PROOF. COLOR, SCALE, AND PLACEMENT ARE FINALIZED ON THE PRESS PROOF YOU&apos;LL APPROVE BEFORE PRODUCTION.
            </p>
          </div>
        </div>
      )}
      {state === "done" && !imgUrl && <p className="font-mono text-[9px] mt-2 font-bold" style={{ color: "#0D9488" }}>✓ ART RECEIVED — {verdict?.notes}</p>}
      {state === "err" && <p className="font-mono text-[9px] mt-2" style={{ color: "#D62839" }}>{msg}</p>}
    </div>
  );
}
