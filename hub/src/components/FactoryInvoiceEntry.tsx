"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function FactoryInvoiceEntry({ factories }: { factories: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ factoryId: factories[0]?.id ?? "", invoiceRef: "", amountUsd: "", invoiceDate: "", paid: true });
  const [state, setState] = useState<"idle"|"busy"|"err">("idle");
  const [msg, setMsg] = useState("");
  const router = useRouter();

  async function submit() {
    setState("busy"); setMsg("");
    const r = await fetch("/api/factories/record-invoice", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...f, amountUsd: parseFloat(f.amountUsd) }) });
    const j = await r.json();
    if (!r.ok) { setState("err"); setMsg(j.error); return; }
    setState("idle"); setF({ ...f, invoiceRef: "", amountUsd: "" }); router.refresh();
  }

  const inp = "w-full mt-1 px-3 py-2 rounded-lg text-[14px] border-2 outline-none bg-white";
  const lbl = "eyebrow block mt-3";

  return (
    <>
      <button onClick={() => setOpen(!open)} className="punch-sm px-4 py-2 rounded-lg font-bold text-[12px]"
        style={{ background: "#181818", color: "#fff" }}>{open ? "Close" : "+ Record factory invoice"}</button>
      {open && (
        <div className="rounded-xl punch p-5 mt-3" style={{ background: "#FFFFFF" }}>
          <div className="grid md:grid-cols-2 gap-x-4">
            <div><label className={lbl} style={{ color: "#5C574A" }}>FACTORY</label>
              <select className={inp} style={{ borderColor: "#E7DFCE" }} value={f.factoryId} onChange={e => setF({ ...f, factoryId: e.target.value })}>
                {factories.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select></div>
            <div><label className={lbl} style={{ color: "#5C574A" }}>THEIR INVOICE # / REF</label>
              <input className={inp} style={{ borderColor: "#E7DFCE" }} value={f.invoiceRef} onChange={e => setF({ ...f, invoiceRef: e.target.value })} /></div>
            <div><label className={lbl} style={{ color: "#5C574A" }}>AMOUNT (USD)</label>
              <input inputMode="decimal" className={inp} style={{ borderColor: "#E7DFCE" }} value={f.amountUsd} onChange={e => setF({ ...f, amountUsd: e.target.value.replace(/[^\d.]/g, "") })} /></div>
            <div><label className={lbl} style={{ color: "#5C574A" }}>INVOICE DATE</label>
              <input type="date" className={inp} style={{ borderColor: "#E7DFCE" }} value={f.invoiceDate} onChange={e => setF({ ...f, invoiceDate: e.target.value })} /></div>
          </div>
          <button onClick={() => setF({ ...f, paid: !f.paid })} className="flex items-center gap-2 mt-4">
            <span className="text-[15px]">{f.paid ? "☑" : "☐"}</span>
            <span className="text-[12px] font-bold" style={{ color: "#181818" }}>Already paid</span>
          </button>
          <button onClick={submit} disabled={state === "busy" || !f.invoiceRef || !f.amountUsd || !f.invoiceDate}
            className="punch-sm w-full mt-4 py-2.5 rounded-lg font-bold text-[13px] disabled:opacity-50" style={{ background: "#0D9488", color: "#fff" }}>
            {state === "busy" ? "Recording…" : "Record"}
          </button>
          {state === "err" && <p className="font-mono text-[11px] mt-2" style={{ color: "#D62839" }}>{msg}</p>}
        </div>
      )}
    </>
  );
}
