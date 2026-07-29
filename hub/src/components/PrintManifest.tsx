"use client";
// Word counts + the sequenced print file. What printing needs, nothing more.
import { useState } from "react";

const INK = "#181818", TEAL = "#0D9488", LINE = "#E7DFCE";

type Summary = { run: string; totalPeels: number; rolls: number; peelsPerRoll: number; words: { word: string; count: number }[] };

export function PrintManifest({ runId }: { runId: string }) {
  const [sum, setSum] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setErr(""); setBusy(true);
    const res = await fetch(`/api/arcade/printfile?runId=${runId}&format=summary`);
    setBusy(false);
    if (!res.ok) { setErr((await res.json()).error ?? "registry not ready"); return; }
    setSum(await res.json());
  }

  return (
    <div className="mt-2">
      {!sum ? (
        <button onClick={load} disabled={busy} className="px-3 py-1.5 rounded font-mono text-[10px] font-bold disabled:opacity-40"
          style={{ background: "#F4EFE3", color: INK, border: `2px solid ${LINE}` }}>
          {busy ? "…" : "VIEW WORD MANIFEST"}
        </button>
      ) : (
        <div className="rounded border-2 p-2.5 mt-1" style={{ borderColor: LINE, background: "#FDFBF5" }}>
          <p className="font-mono text-[10px] font-bold" style={{ color: INK }}>
            {sum.rolls} ROLLS × {sum.peelsPerRoll} · {sum.words.length} DISTINCT WORDS
          </p>
          <div className="grid grid-cols-3 gap-x-3 mt-1.5" style={{ maxHeight: 180, overflowY: "auto" }}>
            {sum.words.map(w => (
              <p key={w.word} className="font-mono text-[10px] flex justify-between" style={{ color: "#3E3A30" }}>
                <span>{w.word}</span><span style={{ color: TEAL }}>×{w.count.toLocaleString()}</span>
              </p>
            ))}
          </div>
          <a href={`/api/arcade/printfile?runId=${runId}&format=csv`}
            className="block text-center mt-2 py-2 rounded font-mono text-[10px] font-bold"
            style={{ background: INK, color: "#fff" }}>
            ⬇ DOWNLOAD PRINT FILE (SEQ · ROLL · PACK · WORD · CODE)
          </a>
        </div>
      )}
      {err && <p className="font-mono text-[9px] mt-1" style={{ color: "#B45309" }}>{err}</p>}
    </div>
  );
}
