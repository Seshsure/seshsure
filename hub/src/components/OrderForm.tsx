"use client";
import { useState } from "react";
import { ArtUploader } from "./ArtUploader";

type P = { id: string; sku: string; description: string };
type A = { id: string; label: string };

export function OrderForm({ products, addresses }: { products: P[]; addresses: A[] }) {
  const [items, setItems] = useState<{ productId: string; quantity: string }[]>([{ productId: products[0]?.id ?? "", quantity: "" }]);
  const [addressId, setAddressId] = useState(addresses[0]?.id ?? "");
  const [po, setPo] = useState("");
  const [supply, setSupply] = useState("");
  const [notes, setNotes] = useState("");
  const [artId, setArtId] = useState<string | null>(null);
  const [state, setState] = useState<"idle"|"busy"|"done"|"err">("idle");
  const [msg, setMsg] = useState("");

  const valid = po.length > 0 && addressId && items.every(i => i.productId && parseInt(i.quantity) > 0);

  async function submit() {
    setState("busy"); setMsg("");
    const r = await fetch("/api/orders/place", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: items.map(i => ({ productId: i.productId, quantity: parseInt(i.quantity) })),
        shipAddressId: addressId, poNumber: po,
        weeksOfSupply: supply ? parseInt(supply) : undefined,
        specialInstructions: notes || undefined,
        artAssetId: artId ?? undefined,
      }) });
    const j = await r.json();
    if (!r.ok) { setState("err"); setMsg(typeof j.error === "string" ? j.error : "check the form"); return; }
    setState("done"); setMsg(j.message);
  }

  const inp = "w-full mt-1 px-3 py-2.5 rounded-lg text-[13px] border outline-none";
  const lbl = "block text-[9px] font-mono font-bold mt-3";

  if (state === "done") return (
    <div className="rounded-xl border p-5 text-center" style={{ background: "#fff", borderColor: "#E7DFCE" }}>
      <p className="text-[15px] font-bold" style={{ color: "#0D9488" }}>✓ Order submitted</p>
      <p className="text-[11px] mt-2" style={{ color: "#514C41" }}>{msg}</p>
      <a href="/portal" className="inline-block mt-4 px-5 py-2.5 rounded-lg font-bold text-[12px]" style={{ background: "#181818", color: "#fff" }}>Back home</a>
    </div>
  );

  return (
    <div className="rounded-xl border p-4" style={{ background: "#fff", borderColor: "#E7DFCE" }}>
      {items.map((it, i) => (
        <div key={i} className="flex gap-2 items-end mb-2">
          <div className="flex-[2]">
            <label className={lbl} style={{ color: "#514C41" }}>PRODUCT</label>
            <select value={it.productId} onChange={e => setItems(items.map((x, n) => n === i ? { ...x, productId: e.target.value } : x))}
              className={inp} style={{ borderColor: "#E7DFCE" }}>
              {products.map(p => <option key={p.id} value={p.id}>{p.description}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className={lbl} style={{ color: "#514C41" }}>CONES</label>
            <input value={it.quantity} onChange={e => setItems(items.map((x, n) => n === i ? { ...x, quantity: e.target.value.replace(/\D/g,"") } : x))}
              placeholder="100000" inputMode="numeric" className={inp} style={{ borderColor: "#E7DFCE" }} />
          </div>
          {items.length > 1 && <button onClick={() => setItems(items.filter((_, n) => n !== i))} className="pb-3 text-[10px] font-mono" style={{ color: "#514C41" }}>✕</button>}
        </div>
      ))}
      <button onClick={() => setItems([...items, { productId: products[0]?.id ?? "", quantity: "" }])}
        className="w-full py-2 rounded-lg text-[11px] font-bold border mb-1" style={{ borderColor: "#0D9488", color: "#0D9488" }}>+ Add product</button>

      <label className={lbl} style={{ color: "#514C41" }}>SHIP TO</label>
      <select value={addressId} onChange={e => setAddressId(e.target.value)} className={inp} style={{ borderColor: "#E7DFCE" }}>
        {addresses.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
      </select>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl} style={{ color: "#514C41" }}>YOUR PO NUMBER *</label>
          <input value={po} onChange={e => setPo(e.target.value)} className={inp} style={{ borderColor: "#E7DFCE" }} />
        </div>
        <div>
          <label className={lbl} style={{ color: "#514C41" }}>WEEKS THIS ORDER LASTS YOU</label>
          <input value={supply} onChange={e => setSupply(e.target.value.replace(/\D/g,""))} placeholder="8" inputMode="numeric" className={inp} style={{ borderColor: "#E7DFCE" }} />
        </div>
      </div>
      <ArtUploader onRegistered={setArtId} />
      {artId && <p className="font-mono text-[8px] mt-1" style={{ color: "#0D9488" }}>✓ ART ATTACHED TO THIS ORDER</p>}

      <label className={lbl} style={{ color: "#514C41" }}>SPECIAL INSTRUCTIONS</label>
      <input value={notes} onChange={e => setNotes(e.target.value)} className={inp} style={{ borderColor: "#E7DFCE" }} />

      <button onClick={submit} disabled={state === "busy" || !valid}
        className="w-full mt-4 py-3 rounded-lg font-bold text-[13px] disabled:opacity-50" style={{ background: "#181818", color: "#fff" }}>
        {state === "busy" ? "Submitting…" : "Submit order"}
      </button>
      {state === "err" && <p className="text-[10px] font-mono mt-2" style={{ color: "#D62839" }}>{msg}</p>}
      <p className="text-[8px] font-mono mt-3 text-center" style={{ color: "#514C41" }}>
        PRICING PER YOUR AGREEMENT · CONFIRMATION + TIMELINE FOLLOWS APPROVAL
      </p>
    </div>
  );
}
