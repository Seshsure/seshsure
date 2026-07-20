"use client";
import { useState } from "react";
import { DisputeMediaUploader, UploadedMedia } from "./DisputeMediaUploader";

const ISSUES = ["print defect","paper tear","burn issue","wrong size","wrong quantity","packaging damage","other"];

export function DisputeForm({ orders }: { orders: { id: string; label: string }[] }) {
  const [orderId, setOrderId] = useState(orders[0]?.id ?? "");
  const [lot, setLot] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [desc, setDesc] = useState("");
  const [qty, setQty] = useState("");
  const [pct, setPct] = useState("");
  const [stopped, setStopped] = useState(false);
  const [want, setWant] = useState<"replacement"|"credit"|"refund"|"other">("replacement");
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [state, setState] = useState<"idle"|"busy"|"done"|"err">("idle");
  const [msg, setMsg] = useState("");

  const photos = media.filter(m => m.kind === "photo");
  const valid = orderId && issues.length > 0 && desc.length >= 10 && photos.length > 0;

  async function submit() {
    setState("busy"); setMsg("");
    const r = await fetch("/api/disputes", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId, lotNumber: lot || undefined, issueTypes: issues, description: desc,
        qtyAffectedUnits: qty ? parseInt(qty) : undefined,
        pctInspected: pct ? parseInt(pct) : undefined,
        productionStopped: stopped, desiredResolution: want,
        mediaPaths: media.map(m => m.path),
        mediaKinds: media.map(m => m.kind),
      }) });
    const j = await r.json();
    if (!r.ok) { setState("err"); setMsg(typeof j.error === "string" ? j.error : "check the form"); return; }
    setState("done"); setMsg(j.message);
  }

  if (state === "done") return (
    <div className="mt-4 rounded-xl border p-5 text-center" style={{ background: "#fff", borderColor: "#E7DFCE" }}>
      <p className="text-[15px] font-bold" style={{ color: "#0D9488" }}>✓ Dispute received</p>
      <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "#514C41" }}>{msg}</p>
    </div>
  );

  const lbl = "block text-[9px] font-mono font-bold mt-3";
  const inp = "w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] border outline-none";

  return (
    <div className="rounded-xl border p-4 mt-3" style={{ background: "#fff", borderColor: "#E7DFCE" }}>
      <label className={lbl} style={{ color: "#514C41" }}>WHICH ORDER</label>
      <select value={orderId} onChange={e => setOrderId(e.target.value)} className={inp} style={{ borderColor: "#E7DFCE" }}>
        {orders.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <label className={lbl} style={{ color: "#514C41" }}>LOT NUMBER (ON THE CARTON)</label>
      <input value={lot} onChange={e => setLot(e.target.value)} placeholder="GL-20143-B" className={inp} style={{ borderColor: "#E7DFCE" }} />
      <label className={lbl} style={{ color: "#514C41" }}>WHAT&apos;S WRONG *</label>
      <div className="flex gap-1.5 flex-wrap mt-1">
        {ISSUES.map(i => (
          <button key={i} onClick={() => setIssues(issues.includes(i) ? issues.filter(x => x !== i) : [...issues, i])}
            className="font-mono text-[9px] font-bold px-2.5 py-1.5 rounded-lg border"
            style={{ background: issues.includes(i) ? "#181818" : "transparent", color: issues.includes(i) ? "#fff" : "#514C41", borderColor: issues.includes(i) ? "#181818" : "#E7DFCE" }}>
            {i.toUpperCase()}
          </button>
        ))}
      </div>
      <label className={lbl} style={{ color: "#514C41" }}>TELL US WHAT YOU&apos;RE SEEING *</label>
      <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} className={inp} style={{ borderColor: "#E7DFCE" }}
        placeholder="What's affected, how you found it, whether it spans cases…" />
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lbl} style={{ color: "#514C41" }}>UNITS AFFECTED (EST.)</label>
          <input value={qty} onChange={e => setQty(e.target.value.replace(/\D/g,""))} inputMode="numeric" className={inp} style={{ borderColor: "#E7DFCE" }} /></div>
        <div><label className={lbl} style={{ color: "#514C41" }}>% OF SHIPMENT INSPECTED</label>
          <input value={pct} onChange={e => setPct(e.target.value.replace(/\D/g,"").slice(0,3))} inputMode="numeric" className={inp} style={{ borderColor: "#E7DFCE" }} /></div>
      </div>
      <button onClick={() => setStopped(!stopped)} className="w-full flex items-center mt-3 px-3 py-2.5 rounded-lg border text-left"
        style={{ borderColor: stopped ? "#D62839" : "#E7DFCE", background: stopped ? "#D628390A" : "transparent" }}>
        <span className="text-[13px] mr-2">{stopped ? "🔴" : "⚪"}</span>
        <span className="text-[11px] font-bold" style={{ color: stopped ? "#D62839" : "#514C41" }}>This is stopping our production line</span>
      </button>
      <label className={lbl} style={{ color: "#514C41" }}>WHAT WOULD MAKE THIS RIGHT</label>
      <div className="flex gap-1.5 mt-1">
        {(["replacement","credit","refund","other"] as const).map(w => (
          <button key={w} onClick={() => setWant(w)} className="flex-1 py-2 rounded-lg font-mono text-[8px] font-bold border"
            style={{ background: want === w ? "#181818" : "transparent", color: want === w ? "#fff" : "#514C41", borderColor: want === w ? "#181818" : "#E7DFCE" }}>
            {w.toUpperCase()}
          </button>
        ))}
      </div>
      <DisputeMediaUploader onChange={setMedia} />
      <button onClick={submit} disabled={state === "busy" || !valid}
        className="w-full mt-4 py-3 rounded-lg font-bold text-[13px] disabled:opacity-50" style={{ background: "#181818", color: "#fff" }}>
        {state === "busy" ? "Submitting…" : "Submit dispute"}
      </button>
      {state === "err" && <p className="font-mono text-[9px] mt-2" style={{ color: "#D62839" }}>{msg}</p>}
      <p className="font-mono text-[7px] mt-3 text-center leading-relaxed" style={{ color: "#7A7365" }}>
        PLEASE QUARANTINE AFFECTED PRODUCT — WE MAY NEED SAMPLES RETURNED · PHOTOS PROTECT YOU AS MUCH AS US
      </p>
    </div>
  );
}
