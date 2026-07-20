"use client";
import { useEffect, useState } from "react";

type Rfq = { mode: string; cargo_summary: Record<string, string | number> | null; bid_deadline: string | null;
  incoterm: string | null; dims_note: string | null; stackable: boolean | null; hazmat: boolean };

export function QuoteForm({ token }: { token: string }) {
  const [rfq, setRfq] = useState<Rfq | null>(null);
  const [who, setWho] = useState("");
  const [err, setErr] = useState("");
  const [f, setF] = useState({ amountUsd: "", transitDays: "", etaPickup: "", etaDelivery: "", validUntil: "", quotedByName: "", note: "" });
  const [state, setState] = useState<"load"|"idle"|"busy"|"done"|"err">("load");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch(`/api/public/freight-quote?token=${token}`).then(r => r.json()).then(j => {
      if (j.ok) { setRfq(j.rfq); setWho(j.forwarder); setState("idle"); }
      else { setErr(j.error === "expired" || j.error === "closed" ? "This quote request has closed." : "Link not recognized."); setState("err"); }
    });
  }, [token]);

  async function submit() {
    setState("busy"); setMsg("");
    const r = await fetch("/api/public/freight-quote", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, amountUsd: parseFloat(f.amountUsd), transitDays: f.transitDays ? parseInt(f.transitDays) : undefined,
        etaPickup: f.etaPickup || undefined, etaDelivery: f.etaDelivery || undefined, validUntil: f.validUntil,
        quotedByName: f.quotedByName, note: f.note || undefined }) });
    const j = await r.json();
    if (!r.ok) { setState("idle"); setMsg(j.error); return; }
    setState("done"); setMsg(j.message);
  }

  const lbl = "eyebrow block mt-4"; const inp = "w-full mt-1 px-3 py-2.5 rounded-lg text-[14px] border-2 outline-none bg-white";
  if (state === "load") return <p className="font-mono text-[12px] mt-6" style={{ color: "#5C574A" }}>Loading…</p>;
  if (state === "err") return <div className="punch-sm rounded-xl bg-white p-5 mt-5"><p className="text-[14px] font-bold" style={{ color: "#181818" }}>{err}</p><p className="text-[12px] mt-1" style={{ color: "#5C574A" }}>Reach your SeshSure contact for a fresh link.</p></div>;
  if (state === "done") return <div className="punch rounded-xl bg-white p-6 mt-5 text-center"><p className="text-[16px] font-bold" style={{ color: "#0D9488" }}>✓ {msg}</p></div>;

  return (
    <>
      <div className="rounded-xl border-2 mt-5 overflow-hidden bg-white" style={{ borderColor: "#181818" }}>
        <div className="px-4 py-2 border-b-2 flex justify-between" style={{ borderColor: "#181818", background: "#FAF5EA" }}>
          <span className="eyebrow" style={{ color: "#3E3A30" }}>SHIPMENT — QUOTING AS {who.toUpperCase()}</span>
          <span className="eyebrow" style={{ color: "#0D9488" }}>{rfq!.mode.toUpperCase()}{rfq!.incoterm ? ` · ${rfq!.incoterm}` : ""}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 p-4 text-[13px]">
          <div><span className="eyebrow" style={{ color: "#5C574A" }}>ORIGIN</span><p className="font-bold" style={{ color: "#181818" }}>{String(rfq!.cargo_summary?.origin ?? "Per shipment sheet")}</p></div>
          <div><span className="eyebrow" style={{ color: "#5C574A" }}>DESTINATION</span><p className="font-bold" style={{ color: "#181818" }}>{String(rfq!.cargo_summary?.destination ?? "Denver, CO area")}</p></div>
          <div><span className="eyebrow" style={{ color: "#5C574A" }}>CARGO</span><p style={{ color: "#181818" }}>{String(rfq!.cargo_summary?.cartons ?? "—")} ctns · {String(rfq!.cargo_summary?.weight_kg ?? "—")} kg{rfq!.dims_note ? ` · ${rfq!.dims_note}` : ""}</p></div>
          <div><span className="eyebrow" style={{ color: "#5C574A" }}>FLAGS</span><p style={{ color: "#181818" }}>{rfq!.stackable === false ? "NOT stackable" : "Stackable"} · {rfq!.hazmat ? "HAZMAT" : "Non-haz"}</p></div>
          <div><span className="eyebrow" style={{ color: "#5C574A" }}>CARGO READY</span><p style={{ color: "#181818" }}>{String(rfq!.cargo_summary?.ready_date ?? "—")}</p></div>
          <div><span className="eyebrow" style={{ color: "#5C574A" }}>NEED BY</span><p style={{ color: "#181818" }}>{rfq!.bid_deadline ? `Bids close ${rfq!.bid_deadline}` : "Flexible"}</p></div>
        </div>
      </div>

      <div className="punch rounded-xl bg-white p-5 mt-5">
        <p className="eyebrow" style={{ color: "#3E3A30" }}>YOUR QUOTE</p>
        <label className={lbl} style={{ color: "#5C574A" }}>ALL-IN AMOUNT (USD) *</label>
        <input inputMode="decimal" className={inp} style={{ borderColor: "#E7DFCE" }} placeholder="4180.00"
          value={f.amountUsd} onChange={e => setF({ ...f, amountUsd: e.target.value.replace(/[^\d.]/g, "") })} />
        <div className="grid grid-cols-2 gap-4">
          <div><label className={lbl} style={{ color: "#5C574A" }}>ETA PICKUP</label>
            <input type="date" className={inp} style={{ borderColor: "#E7DFCE" }} value={f.etaPickup} onChange={e => setF({ ...f, etaPickup: e.target.value })} /></div>
          <div><label className={lbl} style={{ color: "#5C574A" }}>ETA DELIVERY</label>
            <input type="date" className={inp} style={{ borderColor: "#E7DFCE" }} value={f.etaDelivery} onChange={e => setF({ ...f, etaDelivery: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={lbl} style={{ color: "#5C574A" }}>TRANSIT DAYS</label>
            <input inputMode="numeric" className={inp} style={{ borderColor: "#E7DFCE" }} value={f.transitDays} onChange={e => setF({ ...f, transitDays: e.target.value.replace(/\D/g, "") })} /></div>
          <div><label className={lbl} style={{ color: "#5C574A" }}>QUOTE VALID UNTIL *</label>
            <input type="date" className={inp} style={{ borderColor: "#E7DFCE" }} value={f.validUntil} onChange={e => setF({ ...f, validUntil: e.target.value })} /></div>
        </div>
        <label className={lbl} style={{ color: "#5C574A" }}>YOUR NAME *</label>
        <input className={inp} style={{ borderColor: "#E7DFCE" }} value={f.quotedByName} onChange={e => setF({ ...f, quotedByName: e.target.value })} />
        <label className={lbl} style={{ color: "#5C574A" }}>NOTES</label>
        <textarea rows={2} className={inp} style={{ borderColor: "#E7DFCE" }} value={f.note} onChange={e => setF({ ...f, note: e.target.value })} />
        <button onClick={submit} disabled={state === "busy" || !f.amountUsd || !f.validUntil || f.quotedByName.length < 2}
          className="punch-sm w-full mt-5 py-3 rounded-lg font-bold text-[14px] disabled:opacity-50" style={{ background: "#0D9488", color: "#fff" }}>
          {state === "busy" ? "Submitting…" : "Submit quote"}
        </button>
        {msg && <p className="font-mono text-[11px] mt-2" style={{ color: "#D62839" }}>{msg}</p>}
        <p className="font-mono text-[10px] mt-3 leading-relaxed" style={{ color: "#5C574A" }}>
          YOUR QUOTE IS SEALED — OTHER FORWARDERS CANNOT SEE IT. AWARD NOTICE COMES FROM SESHSURE DIRECTLY.
        </p>
      </div>
    </>
  );
}
