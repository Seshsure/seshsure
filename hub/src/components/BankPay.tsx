"use client";
// ————— BANK + PAY — the client's side of the rail —————
// AddBankForm: routing check-digit validated as they type, authorization
// signed with a typed name (evidence trail captured server-side), $0-test
// expectation set honestly. PayBank: the 1% discount is the headline —
// the button itself sells the rail.
import { useState } from "react";
import { useRouter } from "next/navigation";

const INK = "#181818", TEAL = "#0D9488", RED = "#D62839", LINE = "#E7DFCE";

function ckDigit(first8: string): number {
  const w = [3, 7, 1, 3, 7, 1, 3, 7];
  const s = first8.split("").reduce((a, d, i) => a + parseInt(d, 10) * w[i], 0);
  return (10 - (s % 10)) % 10;
}
const routingOk = (r: string) => /^\d{9}$/.test(r) && ckDigit(r.slice(0, 8)) === parseInt(r[8], 10);

export function AddBankForm() {
  const [f, setF] = useState({ bankName: "", routing: "", account: "", accountType: "checking", nameOnAccount: "", signedName: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<[string, boolean] | null>(null);
  const router = useRouter();
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const rOk = f.routing.length === 9 && routingOk(f.routing);

  async function submit() {
    setMsg(null); setBusy(true);
    const res = await fetch("/api/bank/add", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
    setBusy(false);
    const j = await res.json();
    if (!res.ok) { setMsg([j.error ?? "failed", false]); return; }
    setMsg([j.verification, true]); router.refresh();
  }

  const inp = "w-full rounded border-2 px-2 py-1.5 text-[13px] bg-white";
  const lab = "font-mono text-[9px] font-bold tracking-wider mt-2.5 mb-0.5";
  return (
    <div className="rounded-lg border-2 p-3 mt-3" style={{ borderColor: INK, background: "#fff", boxShadow: `4px 4px 0 ${TEAL}` }}>
      <p className="display text-[14px]" style={{ color: INK }}>ADD BANK ACCOUNT</p>
      <p className="font-mono text-[9px] mt-0.5" style={{ color: TEAL }}>PAY BY BANK = 1% CREDIT ON EVERY PAYMENT</p>
      <p className={lab} style={{ color: "#3E3A30" }}>BANK NAME</p>
      <input className={inp} style={{ borderColor: LINE }} value={f.bankName} onChange={set("bankName")} />
      <div className="flex gap-2">
        <div className="grow"><p className={lab} style={{ color: "#3E3A30" }}>ROUTING (9 DIGITS)</p>
          <input className={inp} inputMode="numeric" style={{ borderColor: f.routing ? (rOk ? TEAL : RED) : LINE }}
            value={f.routing} onChange={set("routing")} maxLength={9} />
          {f.routing.length === 9 && !rOk && <p className="font-mono text-[9px]" style={{ color: RED }}>check digit fails — re-check the number</p>}
        </div>
        <div className="grow"><p className={lab} style={{ color: "#3E3A30" }}>ACCOUNT #</p>
          <input className={inp} inputMode="numeric" style={{ borderColor: LINE }} value={f.account} onChange={set("account")} maxLength={17} /></div>
      </div>
      <div className="flex gap-2 items-end">
        <div className="grow"><p className={lab} style={{ color: "#3E3A30" }}>NAME ON ACCOUNT</p>
          <input className={inp} style={{ borderColor: LINE }} value={f.nameOnAccount} onChange={set("nameOnAccount")} /></div>
        <div className="flex gap-1.5 pb-0.5">
          {(["checking", "savings"] as const).map(t => (
            <button key={t} onClick={() => setF({ ...f, accountType: t })} className="px-2.5 py-1.5 rounded font-mono text-[9px] font-bold uppercase"
              style={{ background: f.accountType === t ? INK : "#F4EFE3", color: f.accountType === t ? "#fff" : "#3E3A30" }}>{t}</button>
          ))}
        </div>
      </div>
      <div className="rounded border-2 p-2 mt-3" style={{ borderColor: LINE, background: "#FDFBF5" }}>
        <p className="text-[11px] leading-snug" style={{ color: "#3E3A30" }}>
          <b>Debit Authorization.</b> By typing your name below, you authorize Vido Manufacturing and
          Distribution Corp d/b/a SeshSure to debit the account above for payments <b>you initiate</b> in
          the SeshSure Hub, and to send a $0 verification entry. Each debit occurs only when you press PAY
          and confirm the amount. This authorization stays in effect until you remove the account or
          notify us in writing, and complies with NACHA Operating Rules for corporate (CCD) entries.
        </p>
        <input className={inp + " mt-2"} style={{ borderColor: f.signedName.length > 1 ? TEAL : LINE }}
          placeholder="Type your full name as signature" value={f.signedName} onChange={set("signedName")} />
      </div>
      <button onClick={submit} disabled={busy || !rOk || f.account.length < 4 || f.bankName.length < 2 || f.nameOnAccount.length < 2 || f.signedName.length < 2}
        className="mt-2.5 w-full py-2.5 rounded font-mono text-[11px] font-bold disabled:opacity-40"
        style={{ background: INK, color: "#fff" }}>{busy ? "…" : "SAVE + START $0 VERIFICATION"}</button>
      {msg && <p className="font-mono text-[10px] mt-1.5" style={{ color: msg[1] ? TEAL : RED }}>{msg[0]}</p>}
    </div>
  );
}

export function PayBank({ invoiceId, remainingCents, unlocked, verifying }: {
  invoiceId: string; remainingCents: string; unlocked: boolean; verifying: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<[string, boolean] | null>(null);
  const router = useRouter();
  const remaining = BigInt(remainingCents);
  const discount = remaining / 100n;
  const fmt = (c: bigint) => "$" + (Number(c) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 });

  async function pay() {
    setMsg(null); setBusy(true);
    const res = await fetch("/api/pay", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ invoiceId, amountCents: remainingCents }) });
    setBusy(false);
    const j = await res.json();
    if (!res.ok) { setMsg([j.error ?? "failed", false]); setConfirming(false); return; }
    setMsg(["Payment authorized — it rides today's batch and shows PROCESSING until it clears (1–3 business days). Your 1% credit applies on clearing.", true]);
    setConfirming(false); router.refresh();
  }

  if (remaining <= 0n) return null;
  if (verifying) return (
    <p className="font-mono text-[10px] mt-3" style={{ color: "#B45309" }}>
      BANK VERIFYING (≈3 BUSINESS DAYS) — PAY UNLOCKS AUTOMATICALLY, WITH THE 1% DISCOUNT.</p>);
  if (!unlocked) return (
    <a href="/portal/money" className="block text-center mt-3 py-2.5 rounded font-mono text-[11px] font-bold"
      style={{ background: "#fff", color: INK, border: `2px solid ${INK}` }}>
      ADD A BANK ACCOUNT — PAY BY BANK &amp; SAVE 1%</a>);

  return (
    <div className="mt-3">
      {!confirming ? (
        <button onClick={() => setConfirming(true)}
          className="w-full py-3 rounded font-mono text-[12px] font-bold tracking-wider"
          style={{ background: INK, color: "#FFFDF6", boxShadow: `4px 4px 0 ${TEAL}` }}>
          PAY {fmt(remaining)} BY BANK → EARN {fmt(discount)} CREDIT
        </button>
      ) : (
        <div className="rounded-lg border-2 p-3" style={{ borderColor: INK, background: "#fff" }}>
          <p className="text-[13px]" style={{ color: INK }}>
            Debit <b>{fmt(remaining)}</b> from your verified account. A <b>{fmt(discount)}</b> credit
            (1%) applies to your account when the payment clears.
          </p>
          <div className="flex gap-2 mt-2">
            <button onClick={pay} disabled={busy} className="grow py-2.5 rounded font-mono text-[11px] font-bold disabled:opacity-40"
              style={{ background: TEAL, color: "#fff" }}>{busy ? "…" : "CONFIRM PAYMENT"}</button>
            <button onClick={() => setConfirming(false)} className="px-4 py-2.5 rounded font-mono text-[11px] font-bold"
              style={{ background: "#F4EFE3", color: INK }}>CANCEL</button>
          </div>
        </div>
      )}
      {msg && <p className="font-mono text-[10px] mt-1.5" style={{ color: msg[1] ? TEAL : RED }}>{msg[0]}</p>}
    </div>
  );
}
