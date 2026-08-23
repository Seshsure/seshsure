"use client";
// Owner adds SOA entries: kind → sign handled server-side, entity required
// on charges (ST Global = goods paper, Solitude Flame = services paper —
// same shipments, two invoices, per how the factory actually bills).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadDirect } from "@/lib/upload-client";

const INK = "#181818", TEAL = "#0D9488", RED = "#D62839", LINE = "#E7DFCE";
const KINDS: [string, string][] = [
  ["charge_goods", "GOODS INV"], ["charge_services", "SERVICES INV"], ["charge_freight", "FREIGHT"],
  ["payment", "PAYMENT (WIRE)"], ["credit", "CREDIT"], ["adjustment_up", "ADJ +"], ["adjustment_down", "ADJ −"],
];
const ENTITIES = ["ST Global Packs", "Solitude Flame"];

export function SoaAdd({ factoryId }: { factoryId: string }) {
  const [kind, setKind] = useState("payment");
  const [entity, setEntity] = useState("");
  const [refNo, setRefNo] = useState("");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [attachment, setAttachment] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<[string, boolean] | null>(null);
  const router = useRouter();
  const isCharge = kind.startsWith("charge");

  async function pickDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true);
    const r = await uploadDirect("factory-docs", f);
    setUploading(false);
    if (r.ok) setAttachment(r.path); else setMsg([r.error, false]);
  }

  async function add() {
    setMsg(null); setBusy(true);
    const cents = Math.round(parseFloat(amount) * 100);
    const res = await fetch("/api/soa", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "add", factoryId, kind,
        billingEntity: isCharge && entity ? entity : undefined,
        refNo: refNo || undefined, description: desc, amountCents: cents,
        entryDate: date, attachmentPath: attachment ?? undefined }) });
    setBusy(false);
    if (!res.ok) { setMsg([(await res.json()).error ?? "failed", false]); return; }
    setMsg(["Line added — factory sees it live", true]);
    setRefNo(""); setDesc(""); setAmount(""); setAttachment(null);
    router.refresh();
  }

  const inp = "rounded border-2 px-2 py-1.5 text-[13px] bg-white";
  return (
    <div className="rounded-lg border-2 p-3 mb-4" style={{ borderColor: LINE, background: "#fff" }}>
      <p className="font-mono text-[10px] font-bold" style={{ color: "#3E3A30" }}>ADD STATEMENT LINE</p>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {KINDS.map(([k, label]) => (
          <button key={k} onClick={() => setKind(k)} className="px-2 py-1 rounded font-mono text-[9px] font-bold"
            style={{ background: kind === k ? INK : "#F4EFE3", color: kind === k ? "#fff" : "#3E3A30" }}>{label}</button>
        ))}
      </div>
      {isCharge && (
        <div className="flex gap-1.5 mt-1.5">
          {ENTITIES.map(e => (
            <button key={e} onClick={() => setEntity(e)} className="px-2 py-1 rounded font-mono text-[9px] font-bold"
              style={{ background: entity === e ? TEAL : "#F4EFE3", color: entity === e ? "#fff" : "#3E3A30" }}>{e.toUpperCase()}</button>
          ))}
        </div>
      )}
      <div className="flex gap-2 mt-2">
        <input className={inp + " w-28"} placeholder="Ref / Inv #" value={refNo} onChange={e => setRefNo(e.target.value)} style={{ borderColor: LINE }} />
        <input className={inp + " grow"} placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} style={{ borderColor: LINE }} />
      </div>
      <div className="flex gap-2 mt-2 items-center">
        <input className={inp + " w-32"} inputMode="decimal" placeholder="Amount USD" value={amount} onChange={e => setAmount(e.target.value)} style={{ borderColor: LINE }} />
        <input type="date" className={inp} value={date} onChange={e => setDate(e.target.value)} style={{ borderColor: LINE }} />
        <label className="font-mono text-[9px] cursor-pointer" style={{ color: attachment ? TEAL : "#5C574A" }}>
          {uploading ? "…" : attachment ? "📎 ✓" : "📎 DOC"}
          <input type="file" className="hidden" accept=".pdf,.jpg,.png" onChange={pickDoc} />
        </label>
      </div>
      <button onClick={add} disabled={busy || desc.length < 3 || !(parseFloat(amount) > 0) || (isCharge && kind !== "adjustment_up" && !entity)}
        className="mt-2 w-full py-2 rounded font-mono text-[10px] font-bold disabled:opacity-40" style={{ background: INK, color: "#fff" }}>
        {busy ? "…" : "ADD TO LIVE STATEMENT"}
      </button>
      {msg && <p className="font-mono text-[10px] mt-1" style={{ color: msg[1] ? TEAL : RED }}>{msg[0]}</p>}
    </div>
  );
}
