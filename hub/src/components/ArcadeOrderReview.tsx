"use client";
// One consolidated decision per SOP: approve, or a single revision note
// that lists everything at once. No partial approvals.
import { useState } from "react";
import { useRouter } from "next/navigation";

const INK = "#181818", TEAL = "#0D9488", RED = "#D62839", LINE = "#E7DFCE", PURPLE = "#6C4AB0";

type Tier = { count: number; picks?: string[] };
type Order = {
  id: string; order_number: string; qty_packs: number; retail_format: string;
  custom_words: { word: string; category: string }[]; use_standard_mix: boolean;
  tiers: { common: Tier; uncommon: Tier; rare: Tier; epic: Tier; legendary: Tier; golden: { word: string } };
  hunt_sentence: string | null; ship_to: string | null; needed_by: string | null;
  sale_states: string[]; notes: string | null; artwork_path: string | null;
  submitted_at: string; clients: unknown;
};

export function ArcadeOrderReview({ order }: { order: Order }) {
  const c = order.clients as { legal_name: string; dba: string | null } | { legal_name: string; dba: string | null }[] | null;
  const cl = Array.isArray(c) ? c[0] : c;
  const [note, setNote] = useState("");
  const [revising, setRevising] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();
  const t = order.tiers;
  const total = order.qty_packs * 800;

  async function decide(action: "approve" | "revise") {
    setErr(""); setBusy(true);
    const res = await fetch("/api/arcade/orders", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, orderId: order.id, revisionNote: action === "revise" ? note : undefined }) });
    setBusy(false);
    if (!res.ok) { setErr((await res.json()).error ?? "failed"); return; }
    router.refresh();
  }

  return (
    <div className="rounded-lg border-2 p-3 mt-2 bg-white" style={{ borderColor: PURPLE }}>
      <div className="flex items-center justify-between">
        <p className="font-mono text-[12px] font-bold" style={{ color: INK }}>
          {order.order_number} · {cl?.dba ?? cl?.legal_name ?? "?"}
        </p>
        <p className="font-mono text-[9px]" style={{ color: "#5C574A" }}>{order.submitted_at?.slice(0, 10)}</p>
      </div>
      <p className="font-mono text-[10px] mt-1" style={{ color: "#3E3A30" }}>
        {order.qty_packs}×800 = {total.toLocaleString()} peels · {order.retail_format}-cone retail · states: {order.sale_states.join(", ")}
        {order.needed_by ? ` · needed ${order.needed_by}` : ""} · art: {order.artwork_path ? "✓ attached" : "— none"}
      </p>
      <p className="font-mono text-[10px] mt-1" style={{ color: "#3E3A30" }}>
        TIERS — C:{t.common.count.toLocaleString()} U:{t.uncommon.count.toLocaleString()} R:{t.rare.count} E:{t.epic.count} L:{t.legendary.count} · GOLDEN: <b>{t.golden.word}</b>
      </p>
      {(t.rare.picks?.length || t.epic.picks?.length || t.legendary.picks?.length) ? (
        <p className="font-mono text-[9px] mt-0.5" style={{ color: "#5C574A" }}>
          picks — R:[{(t.rare.picks ?? []).join(",")}] E:[{(t.epic.picks ?? []).join(",")}] L:[{(t.legendary.picks ?? []).join(",")}]
        </p>) : null}
      <p className="font-mono text-[10px] mt-0.5" style={{ color: "#3E3A30" }}>
        WORDS — standard mix {order.use_standard_mix ? "ON" : "OFF"} + {order.custom_words.length} custom
        {order.custom_words.length > 0 && `: ${order.custom_words.map(w => w.word).join(", ")}`}
      </p>
      {order.hunt_sentence && <p className="font-mono text-[10px] mt-0.5" style={{ color: PURPLE }}>HUNT: &ldquo;{order.hunt_sentence}&rdquo;</p>}
      {order.notes && <p className="text-[11px] italic mt-1" style={{ color: "#5C574A" }}>&ldquo;{order.notes}&rdquo;</p>}
      <p className="font-mono text-[9px] mt-1" style={{ color: "#5C574A" }}>SHIP TO: {order.ship_to}</p>

      {!revising ? (
        <div className="flex gap-2 mt-2">
          <button onClick={() => decide("approve")} disabled={busy}
            className="grow py-2 rounded font-mono text-[10px] font-bold disabled:opacity-40" style={{ background: TEAL, color: "#fff" }}>
            APPROVE → REGISTRY
          </button>
          <button onClick={() => setRevising(true)} disabled={busy}
            className="px-4 py-2 rounded font-mono text-[10px] font-bold"
            style={{ background: "#fff", color: "#B45309", border: "2px solid #B45309" }}>REQUEST REVISIONS</button>
        </div>
      ) : (
        <div className="mt-2">
          <textarea className="w-full rounded border-2 px-2 py-1.5 text-[12px]" style={{ borderColor: LINE }} rows={3}
            placeholder="ONE consolidated list — everything that needs to change, in one note"
            value={note} onChange={e => setNote(e.target.value)} />
          <div className="flex gap-2 mt-1.5">
            <button onClick={() => decide("revise")} disabled={busy || note.trim().length < 5}
              className="grow py-2 rounded font-mono text-[10px] font-bold disabled:opacity-40" style={{ background: "#B45309", color: "#fff" }}>
              SEND REVISION LIST
            </button>
            <button onClick={() => setRevising(false)} className="px-3 py-2 rounded font-mono text-[10px] font-bold"
              style={{ background: "#F4EFE3", color: INK }}>CANCEL</button>
          </div>
        </div>
      )}
      {err && <p className="font-mono text-[10px] mt-1" style={{ color: RED }}>{err}</p>}
    </div>
  );
}
