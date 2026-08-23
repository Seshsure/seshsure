"use client";
// ————— SOA STATEMENT — the same table both sides read —————
// Running balance computed newest-last so the bottom line is THE number.
// Factory side gets CONFIRM / DISPUTE per line; owner side sees the
// confirmation state. One component, two audiences, zero divergence.
import { useState } from "react";
import { useRouter } from "next/navigation";

const INK = "#181818", TEAL = "#0D9488", RED = "#D62839", LINE = "#E7DFCE", ORANGE = "#B45309", PURPLE = "#6C4AB0";

export type SoaLine = {
  id: string; entry_date: string; kind: string; billing_entity: string | null;
  ref_no: string | null; description: string | null; total_cents: string;
  factory_confirmed_at: string | null; dispute_note: string | null; attachment_path: string | null;
  status?: string; reject_note?: string | null;
};

const fmt = (c: bigint) => (c < 0n ? "−$" : "$") + (Number(c < 0n ? -c : c) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 });
const KIND_LABEL: Record<string, string> = {
  opening_balance: "OPENING", charge_goods: "GOODS", charge_services: "SERVICES",
  charge_freight: "FREIGHT", payment: "PAYMENT", credit: "CREDIT",
  adjustment_up: "ADJ +", adjustment_down: "ADJ −",
};

export function SoaStatement({ lines, side }: { lines: SoaLine[]; side: "factory" | "owner" }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [disputing, setDisputing] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const router = useRouter();

  async function act(body: object, id: string) {
    setErr(""); setBusy(id);
    const res = await fetch("/api/soa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    if (!res.ok) { setErr((await res.json()).error ?? "failed"); return; }
    setDisputing(null); setNote(""); router.refresh();
  }

  const liveLines = lines.filter(l => (l.status ?? "live") === "live");
  const pending = lines.filter(l => l.status === "pending");
  let running = 0n;
  const withBalance = liveLines.map(l => { running += BigInt(l.total_cents); return { ...l, balance: running }; });
  const unconfirmed = liveLines.filter(l => !l.factory_confirmed_at && l.kind !== "opening_balance").length;
  const disputed = liveLines.filter(l => l.dispute_note).length;

  return (
    <div>
      <div className="rounded-lg border-2 p-3 mb-3" style={{ borderColor: INK, background: "#fff", boxShadow: `4px 4px 0 ${TEAL}` }}>
        <div className="flex items-end justify-between">
          <div>
            <p className="font-mono text-[9px] font-bold" style={{ color: "#5C574A" }}>CURRENT BALANCE {side === "factory" ? "OWED TO YOU" : "OWED TO FACTORY"}</p>
            <p className="display text-[26px]" style={{ color: INK }}>{fmt(running)}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[9px]" style={{ color: unconfirmed ? ORANGE : TEAL }}>
              {unconfirmed ? `${unconfirmed} LINE${unconfirmed > 1 ? "S" : ""} AWAITING CONFIRMATION` : "FULLY CONFIRMED ✓"}
            </p>
            {disputed > 0 && <p className="font-mono text-[9px]" style={{ color: RED }}>{disputed} DISPUTED</p>}
          </div>
        </div>
      </div>

      {pending.length > 0 && <>
        <p className="font-mono text-[10px] font-bold mb-1.5" style={{ color: ORANGE }}>
          {side === "owner" ? `${pending.length} FACTORY SUBMISSION${pending.length > 1 ? "S" : ""} AWAITING YOUR APPROVAL — NOT IN BALANCE YET` : `AWAITING SESHSURE APPROVAL — NOT IN BALANCE YET`}
        </p>
        {pending.map(l => (
          <div key={l.id} className="rounded border-2 px-3 py-2 mb-1.5" style={{ borderColor: ORANGE, background: "#FFFBF2" }}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-[10px]" style={{ color: "#5C574A" }}>
                  {l.entry_date} · <b>{KIND_LABEL[l.kind] ?? l.kind}</b>{l.billing_entity ? ` · ${l.billing_entity}` : ""}{l.ref_no ? ` · ${l.ref_no}` : ""}{l.attachment_path ? " · 📎" : ""}
                </p>
                <p className="text-[12px] truncate" style={{ color: INK }}>{l.description}</p>
              </div>
              <p className="font-mono text-[13px] font-bold shrink-0" style={{ color: INK }}>{fmt(BigInt(l.total_cents))}</p>
            </div>
            {side === "owner" && (
              disputing === l.id ? (
                <div className="flex gap-1.5 mt-1.5">
                  <input className="grow rounded border-2 px-2 py-1 text-[12px]" style={{ borderColor: LINE }}
                    placeholder="Why is this rejected?" value={note} onChange={e => setNote(e.target.value)} />
                  <button onClick={() => act({ action: "reject", lineId: l.id, note }, l.id)} disabled={busy === l.id || note.length < 4}
                    className="px-3 py-1 rounded font-mono text-[9px] font-bold disabled:opacity-40" style={{ background: RED, color: "#fff" }}>REJECT</button>
                  <button onClick={() => setDisputing(null)} className="px-2 rounded font-mono text-[9px]" style={{ background: "#F4EFE3" }}>✕</button>
                </div>
              ) : (
                <div className="flex gap-2 mt-1.5">
                  <button onClick={() => act({ action: "approve", lineId: l.id }, l.id)} disabled={busy === l.id}
                    className="grow py-1.5 rounded font-mono text-[9px] font-bold disabled:opacity-40" style={{ background: TEAL, color: "#fff" }}>
                    APPROVE → ENTERS BALANCE + COGS
                  </button>
                  <button onClick={() => setDisputing(l.id)} className="px-3 py-1.5 rounded font-mono text-[9px] font-bold"
                    style={{ background: "#fff", color: RED, border: `2px solid ${RED}` }}>REJECT</button>
                </div>
              )
            )}
          </div>
        ))}
      </>}
      {withBalance.slice().reverse().map(l => {
        const amt = BigInt(l.total_cents);
        const isCredit = amt < 0n;
        return (
          <div key={l.id} className="rounded border-2 px-3 py-2 mb-1.5 bg-white"
            style={{ borderColor: l.dispute_note ? RED : LINE }}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-[10px]" style={{ color: "#5C574A" }}>
                  {l.entry_date} · <b style={{ color: isCredit ? TEAL : PURPLE }}>{KIND_LABEL[l.kind] ?? l.kind}</b>
                  {l.billing_entity ? ` · ${l.billing_entity}` : ""}{l.ref_no ? ` · ${l.ref_no}` : ""}
                  {l.attachment_path ? " · 📎" : ""}
                </p>
                <p className="text-[12px] truncate" style={{ color: INK }}>{l.description}</p>
                {l.dispute_note && <p className="font-mono text-[10px] mt-0.5" style={{ color: RED }}>DISPUTED: {l.dispute_note}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-[13px] font-bold" style={{ color: isCredit ? TEAL : INK }}>{fmt(amt)}</p>
                <p className="font-mono text-[9px]" style={{ color: "#8B857A" }}>bal {fmt(l.balance)}</p>
              </div>
            </div>

            {side === "factory" && l.kind !== "opening_balance" && !l.factory_confirmed_at && (
              disputing === l.id ? (
                <div className="flex gap-1.5 mt-1.5">
                  <input className="grow rounded border-2 px-2 py-1 text-[12px]" style={{ borderColor: LINE }}
                    placeholder="What is incorrect about this line?" value={note} onChange={e => setNote(e.target.value)} />
                  <button onClick={() => act({ action: "dispute", lineId: l.id, note }, l.id)} disabled={busy === l.id || note.length < 4}
                    className="px-3 py-1 rounded font-mono text-[9px] font-bold disabled:opacity-40" style={{ background: RED, color: "#fff" }}>SEND</button>
                  <button onClick={() => setDisputing(null)} className="px-2 rounded font-mono text-[9px]" style={{ background: "#F4EFE3" }}>✕</button>
                </div>
              ) : (
                <div className="flex gap-2 mt-1.5">
                  <button onClick={() => act({ action: "confirm", lineId: l.id }, l.id)} disabled={busy === l.id}
                    className="grow py-1.5 rounded font-mono text-[9px] font-bold disabled:opacity-40" style={{ background: TEAL, color: "#fff" }}>
                    CONFIRM CORRECT
                  </button>
                  <button onClick={() => setDisputing(l.id)}
                    className="px-3 py-1.5 rounded font-mono text-[9px] font-bold"
                    style={{ background: "#fff", color: RED, border: `2px solid ${RED}` }}>DISPUTE</button>
                </div>
              )
            )}
            {side === "factory" && l.factory_confirmed_at && (
              <p className="font-mono text-[9px] mt-1" style={{ color: TEAL }}>✓ CONFIRMED {l.factory_confirmed_at.slice(0, 10)}</p>
            )}
            {side === "owner" && (
              <p className="font-mono text-[9px] mt-0.5" style={{ color: l.dispute_note ? RED : l.factory_confirmed_at ? TEAL : ORANGE }}>
                {l.kind === "opening_balance" ? "ANCHOR — AGREED SOA" : l.dispute_note ? "" : l.factory_confirmed_at ? `FACTORY CONFIRMED ${l.factory_confirmed_at.slice(0, 10)}` : "AWAITING FACTORY CONFIRMATION"}
              </p>
            )}
          </div>
        );
      })}
      {err && <p className="font-mono text-[10px] mt-1" style={{ color: RED }}>{err}</p>}
    </div>
  );
}
