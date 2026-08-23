"use client";
// ————— FACTORY INVOICE SUBMISSION — no paper, no line —————
// The factory submits charges with the invoice document attached
// (mandatory — the doc IS the claim). Submitting counts as their
// signature; the line enters the live balance only on SeshSure approval.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadDirect } from "@/lib/upload-client";

const INK = "#181818", TEAL = "#0D9488", RED = "#D62839", LINE = "#E7DFCE";
const KINDS: [string, string][] = [["charge_goods", "GOODS INVOICE"], ["charge_services", "SERVICES INVOICE"], ["charge_freight", "FREIGHT"]];
const ENTITIES = ["ST Global Packs", "Solitude Flame"];

export function SoaSubmit() {
  const [kind, setKind] = useState("charge_goods");
  const [entity, setEntity] = useState("ST Global Packs");
  const [refNo, setRefNo] = useState("");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [attachment, setAttachment] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<[string, boolean] | null>(null);
  const router = useRouter();

  async function pickDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true);
    const r = await uploadDirect("factory-docs", f);
    setUploading(false);
    if (r.ok) setAttachment(r.path); else setMsg([r.error, false]);
  }

  async function submit() {
    setMsg(null); setBusy(true);
    const res = await fetch("/api/soa", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "submit", kind, billingEntity: entity, refNo,
        description: desc, amountCents: Math.round(parseFloat(amount) * 100),
        entryDate: date, attachmentPath: attachment }) });
    setBusy(false);
    const j = await res.json();
    if (!res.ok) { setMsg([j.error ?? "failed", false]); return; }
    setMsg([j.note, true]);
    setRefNo(""); setDesc(""); setAmount(""); setAttachment(null);
    router.refresh();
  }

  const inp = "rounded border-2 px-2 py-1.5 text-[13px] bg-white";
  return (
    <div className="rounded-lg border-2 p-3 mb-4" style={{ borderColor: INK, background: "#fff", boxShadow: "4px 4px 0 #6C4AB0" }}>
      <p className="display text-[14px]" style={{ color: INK }}>SUBMIT AN INVOICE</p>
      <p className="font-mono text-[9px] mt-0.5 mb-1.5" style={{ color: "#5C574A" }}>INVOICE DOCUMENT REQUIRED · ENTERS THE STATEMENT AFTER SESHSURE APPROVAL</p>
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map(([k, label]) => (
          <button key={k} onClick={() => setKind(k)} className="px-2 py-1 rounded font-mono text-[9px] font-bold"
            style={{ background: kind === k ? INK : "#F4EFE3", color: kind === k ? "#fff" : "#3E3A30" }}>{label}</button>
        ))}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        {ENTITIES.map(e => (
          <button key={e} onClick={() => setEntity(e)} className="px-2 py-1 rounded font-mono text-[9px] font-bold"
            style={{ background: entity === e ? TEAL : "#F4EFE3", color: entity === e ? "#fff" : "#3E3A30" }}>{e.toUpperCase()}</button>
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        <input className={inp + " w-28"} placeholder="Invoice #" value={refNo} onChange={e => setRefNo(e.target.value)} style={{ borderColor: LINE }} />
        <input className={inp + " grow"} placeholder="Description (what does this bill?)" value={desc} onChange={e => setDesc(e.target.value)} style={{ borderColor: LINE }} />
      </div>
      <div className="flex gap-2 mt-2 items-center">
        <input className={inp + " w-32"} inputMode="decimal" placeholder="Amount USD" value={amount} onChange={e => setAmount(e.target.value)} style={{ borderColor: LINE }} />
        <input type="date" className={inp} value={date} onChange={e => setDate(e.target.value)} style={{ borderColor: LINE }} />
        <label className="font-mono text-[10px] cursor-pointer px-2 py-1.5 rounded border-2"
          style={{ color: attachment ? "#fff" : INK, background: attachment ? TEAL : "#fff", borderColor: attachment ? TEAL : INK }}>
          {uploading ? "…" : attachment ? "📎 ATTACHED ✓" : "📎 ATTACH INVOICE"}
          <input type="file" className="hidden" accept=".pdf,.jpg,.png" onChange={pickDoc} />
        </label>
      </div>
      <button onClick={submit} disabled={busy || !attachment || desc.length < 3 || refNo.length < 1 || !(parseFloat(amount) > 0)}
        className="mt-2 w-full py-2.5 rounded font-mono text-[10px] font-bold disabled:opacity-40" style={{ background: INK, color: "#fff" }}>
        {busy ? "…" : "SUBMIT FOR APPROVAL"}
      </button>
      {msg && <p className="font-mono text-[10px] mt-1" style={{ color: msg[1] ? TEAL : RED }}>{msg[0]}</p>}
    </div>
  );
}
