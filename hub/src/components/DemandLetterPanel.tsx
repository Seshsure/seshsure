"use client";
import { useState } from "react";

type Letter = { id: string; status: string; totalCents: string; draftText: string; createdAt: string };

export function DemandLetterPanel({ letters }: { letters: Letter[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [via, setVia] = useState<"email"|"certified_mail"|"both">("both");
  const [state, setState] = useState<"idle"|"busy"|"done">("idle");

  async function act(letterId: string, action: "approve_send" | "withdraw") {
    setState("busy");
    await fetch("/api/legal/demand-letter", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ letterId, action, finalText: action === "approve_send" ? text : undefined, sentVia: via }) });
    setState("done");
  }

  return (
    <div className="mt-3 rounded-lg border overflow-hidden" style={{ background: "#FFFFFF", borderColor: "#C7780044" }}>
      <div className="px-3 py-2 border-b" style={{ borderColor: "#E7DFCE" }}>
        <span className="font-mono text-[10px] font-bold" style={{ color: "#C77800" }}>DEMAND LETTERS — DRAFTED BY MACHINE, SENT BY YOU</span>
      </div>
      {letters.map(l => (
        <div key={l.id} className="border-b" style={{ borderColor: "#E7DFCE" }}>
          <button onClick={() => { setOpen(open === l.id ? null : l.id); setText(l.draftText); setState("idle"); }}
            className="w-full flex items-center px-3 py-2.5 text-left">
            <span className="flex-1 text-[11px]" style={{ color: "#181818" }}>
              ${(Number(l.totalCents) / 100).toLocaleString()} · drafted {l.createdAt.slice(0, 10)}
            </span>
            <span className="font-mono text-[8px] font-bold" style={{ color: l.status === "draft" ? "#C77800" : l.status === "approved_sent" ? "#0D9488" : "#9B9484" }}>
              {l.status.replace(/_/g, " ").toUpperCase()}
            </span>
          </button>
          {open === l.id && l.status === "draft" && (
            <div className="px-3 pb-3">
              <textarea value={text} onChange={e => setText(e.target.value)} rows={14}
                className="w-full px-3 py-2 rounded font-mono text-[9px] leading-relaxed border outline-none"
                style={{ background: "#FAF5EA", borderColor: "#E7DFCE", color: "#181818" }} />
              <div className="flex gap-1.5 mt-2">
                {(["email","certified_mail","both"] as const).map(v => (
                  <button key={v} onClick={() => setVia(v)} className="flex-1 py-1.5 rounded font-mono text-[8px] font-bold border"
                    style={{ background: via === v ? "#181818" : "transparent", color: via === v ? "#FAF5EA" : "#6E6A5E", borderColor: "#E7DFCE" }}>
                    {v.replace("_", " ").toUpperCase()}
                  </button>
                ))}
              </div>
              {state === "done" ? <p className="text-[11px] font-bold mt-2 text-center" style={{ color: "#0D9488" }}>✓ Done</p> : (
                <div className="flex gap-2 mt-2">
                  <button onClick={() => act(l.id, "withdraw")} disabled={state === "busy"}
                    className="flex-1 py-2.5 rounded font-bold text-[11px] border" style={{ borderColor: "#E7DFCE", color: "#6E6A5E" }}>Withdraw</button>
                  <button onClick={() => act(l.id, "approve_send")} disabled={state === "busy"}
                    className="flex-[2] py-2.5 rounded font-bold text-[11px]" style={{ background: "#C77800", color: "#FAF5EA" }}>
                    {state === "busy" ? "…" : "Approve & send"}
                  </button>
                </div>
              )}
              <p className="font-mono text-[7px] mt-2" style={{ color: "#9B9484" }}>
                CERTIFIED MAIL: PRINT THIS TEXT, MAIL FROM PARKER PO, KEEP THE GREEN CARD — IT&apos;S COURT EVIDENCE
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
