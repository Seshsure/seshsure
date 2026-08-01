"use client";
// ————— ACH OPS PANEL — the operator's levers until SFTP automates —————
import { useState } from "react";
import { useRouter } from "next/navigation";

const INK = "#181818", RED = "#D62839", LINE = "#E7DFCE", ORANGE = "#B45309";
const RETURN_CODES = ["R01", "R02", "R03", "R04", "R08", "R10", "R16", "R29"];

type Batch = { id: string; at: string; count: number; totalCents: string; status: string };
type Inflight = { id: string; amountCents: string; status: string; at: string; name: string };
type Prenote = { id: string; last4: string; sentAt: string; name: string };

const fmt = (c: string) => "$" + (Number(c) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 });

export function AchOps({ batches, inflight, prenotes }: { batches: Batch[]; inflight: Inflight[]; prenotes: Prenote[] }) {
  const [marking, setMarking] = useState<string | null>(null);
  const [code, setCode] = useState("R01");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();

  async function post(body: object) {
    setErr(""); setBusy(true);
    const res = await fetch("/api/admin/ach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { setErr((await res.json()).error ?? "failed"); return; }
    setMarking(null); router.refresh();
  }

  const H = ({ t }: { t: string }) => <p className="font-mono text-[10px] font-bold mt-5 mb-1.5" style={{ color: "#3E3A30" }}>{t}</p>;

  return (
    <div>
      {batches.length > 0 && <>
        <H t="RELEASED FILES — DOWNLOAD → UPLOAD TO FCB (UNTIL SFTP IS LIVE)" />
        {batches.map(b => (
          <div key={b.id} className="flex items-center justify-between rounded border-2 px-3 py-2 mb-1.5 bg-white" style={{ borderColor: LINE }}>
            <p className="font-mono text-[11px]" style={{ color: INK }}>{b.at} · {b.count} entries · {fmt(b.totalCents)} · {b.status.toUpperCase()}</p>
            <a href={`/api/admin/ach?batchId=${b.id}`} className="px-3 py-1 rounded font-mono text-[9px] font-bold"
              style={{ background: INK, color: "#fff" }}>⬇ .ACH</a>
          </div>
        ))}
      </>}

      {inflight.length > 0 && <>
        <H t="IN-FLIGHT PULLS — MARK RETURNED WHEN FCB REPORTS ONE (DAILY PORTAL CHECK)" />
        {inflight.map(p => (
          <div key={p.id} className="rounded border-2 px-3 py-2 mb-1.5 bg-white" style={{ borderColor: LINE }}>
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px]" style={{ color: INK }}>{p.name} · {fmt(p.amountCents)} · {p.status.toUpperCase()} · {p.at}</p>
              {marking !== p.id ? (
                <button onClick={() => setMarking(p.id)} className="px-2.5 py-1 rounded font-mono text-[9px] font-bold"
                  style={{ background: "#fff", color: RED, border: `2px solid ${RED}` }}>RETURNED?</button>
              ) : null}
            </div>
            {marking === p.id && (
              <div className="flex gap-1.5 mt-1.5 items-center">
                <select className="rounded border-2 px-2 py-1 font-mono text-[10px]" style={{ borderColor: LINE }}
                  value={code} onChange={e => setCode(e.target.value)}>
                  {RETURN_CODES.map(c => <option key={c}>{c}</option>)}
                </select>
                <button onClick={() => post({ action: "mark_returned", paymentId: p.id, returnCode: code })} disabled={busy}
                  className="grow py-1 rounded font-mono text-[9px] font-bold disabled:opacity-40" style={{ background: RED, color: "#fff" }}>
                  CONFIRM RETURN — INVOICES RE-OPEN AUTOMATICALLY
                </button>
                <button onClick={() => setMarking(null)} className="px-2 py-1 rounded font-mono text-[9px] font-bold" style={{ background: "#F4EFE3", color: INK }}>✕</button>
              </div>
            )}
          </div>
        ))}
      </>}

      {prenotes.length > 0 && <>
        <H t="PRENOTES OUT — FAIL ONLY IF FCB REPORTS A RETURN; SILENCE = AUTO-VERIFY IN 3 BANKING DAYS" />
        {prenotes.map(pn => (
          <div key={pn.id} className="flex items-center justify-between rounded border-2 px-3 py-2 mb-1.5 bg-white" style={{ borderColor: LINE }}>
            <p className="font-mono text-[11px]" style={{ color: INK }}>{pn.name} · ····{pn.last4} · sent {pn.sentAt}</p>
            <button onClick={() => post({ action: "fail_prenote", bankAccountId: pn.id })} disabled={busy}
              className="px-2.5 py-1 rounded font-mono text-[9px] font-bold disabled:opacity-40"
              style={{ background: "#fff", color: ORANGE, border: `2px solid ${ORANGE}` }}>MARK FAILED</button>
          </div>
        ))}
      </>}
      {err && <p className="font-mono text-[10px] mt-1" style={{ color: RED }}>{err}</p>}
    </div>
  );
}
