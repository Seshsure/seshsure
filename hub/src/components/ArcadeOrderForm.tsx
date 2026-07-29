"use client";
// ————— ARCADE ORDER FORM — the SOP as a form —————
// Everything the API validates is validated LIVE here first: print-fit as
// they type, tier math against total peels, sentence words against the
// actual available set. Producers fix problems before submitting, and the
// review gate receives clean orders.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadDirect } from "@/lib/upload-client";

const INK = "#181818", TEAL = "#0D9488", RED = "#D62839", LINE = "#E7DFCE", PURPLE = "#6C4AB0", ORANGE = "#B45309";
const CATS = ["glue", "verb", "noun", "flavor"] as const;
const WordRe = /^[A-Z]{1,12}$/;

export function ArcadeOrderForm({ standardPool }: { standardPool: string[] }) {
  const [useStd, setUseStd] = useState(true);
  const [words, setWords] = useState<{ word: string; category: string }[]>([]);
  const [wordInput, setWordInput] = useState("");
  const [cat, setCat] = useState<string>("noun");
  const [qty, setQty] = useState(1);
  const [fmt, setFmt] = useState<"1" | "3">("3");
  const [tiers, setTiers] = useState({ common: 640, uncommon: 120, rare: 30, epic: 7, legendary: 2 });
  const [picks, setPicks] = useState({ rare: "", epic: "", legendary: "" });
  const [golden, setGolden] = useState("");
  const [sentence, setSentence] = useState("");
  const [shipTo, setShipTo] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [states, setStates] = useState("");
  const [notes, setNotes] = useState("");
  const [artPath, setArtPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const router = useRouter();

  const total = qty * 800;
  const tierSum = tiers.common + tiers.uncommon + tiers.rare + tiers.epic + tiers.legendary + 1;
  const available = useMemo(() => {
    const s = new Set(words.map(w => w.word));
    if (useStd) for (const w of standardPool) s.add(w);
    return s;
  }, [words, useStd, standardPool]);

  const wordUp = wordInput.toUpperCase().trim();
  const wordOk = WordRe.test(wordUp) && !words.some(w => w.word === wordUp);
  const goldenUp = golden.toUpperCase().trim();
  const sentenceWords = sentence.toUpperCase().trim().split(/\s+/).filter(Boolean);
  const badSentence = sentenceWords.filter(w => !available.has(w));

  function addWord() {
    if (!wordOk) return;
    setWords([...words, { word: wordUp, category: cat }]);
    setWordInput("");
  }

  async function pickArt(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true);
    const r = await uploadDirect("art", f);
    setUploading(false);
    if (r.ok) setArtPath(r.path); else setErr(r.error);
  }

  async function submit() {
    setErr(""); setBusy(true);
    const res = await fetch("/api/arcade/orders", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "submit", artworkPath: artPath ?? undefined, useStandardMix: useStd,
        customWords: words,
        tiers: {
          common: { count: tiers.common }, uncommon: { count: tiers.uncommon },
          rare: { count: tiers.rare, picks: picks.rare.split(",").map(s => s.trim()).filter(Boolean) },
          epic: { count: tiers.epic, picks: picks.epic.split(",").map(s => s.trim()).filter(Boolean) },
          legendary: { count: tiers.legendary, picks: picks.legendary.split(",").map(s => s.trim()).filter(Boolean) },
          golden: { word: goldenUp },
        },
        huntSentence: sentence || undefined, qtyPacks: qty, retailFormat: fmt,
        shipTo, neededBy: neededBy || undefined,
        saleStates: states.split(",").map(s => s.trim()).filter(Boolean), notes: notes || undefined,
      }) });
    setBusy(false);
    const j = await res.json();
    if (!res.ok) { setErr(j.error ?? "failed"); return; }
    setDone(j.orderNumber); router.refresh();
  }

  if (done) return (
    <div className="rounded-lg border-2 p-4 text-center" style={{ borderColor: TEAL, background: "#0D948808" }}>
      <p className="display text-[16px]" style={{ color: INK }}>ORDER {done} SUBMITTED</p>
      <p className="text-[12px] mt-1" style={{ color: "#3E3A30" }}>Review takes ≤2 business days. One consolidated decision — approve or a single revision list.</p>
    </div>
  );

  const lab = "font-mono text-[9px] font-bold tracking-wider mt-3 mb-1";
  const inp = "w-full rounded border-2 px-2 py-1.5 text-[13px] bg-white";
  const tierRow = (k: keyof typeof tiers, label: string) => (
    <div className="flex items-center gap-2 mt-1">
      <span className="font-mono text-[10px] font-bold w-24" style={{ color: "#3E3A30" }}>{label}</span>
      <input type="number" min={0} className="rounded border-2 px-2 py-1 font-mono text-[12px] w-24" style={{ borderColor: LINE }}
        value={tiers[k]} onChange={e => setTiers({ ...tiers, [k]: Math.max(0, parseInt(e.target.value) || 0) })} />
    </div>
  );

  return (
    <div className="rounded-lg border-2 p-4" style={{ borderColor: INK, background: "#fff", boxShadow: `5px 5px 0 ${PURPLE}` }}>
      {/* QUANTITY + FORMAT */}
      <p className={lab} style={{ color: "#3E3A30" }}>QUANTITY (800-CONE MASTER PACKS) &amp; RETAIL FORMAT</p>
      <div className="flex gap-2 items-center">
        <input type="number" min={1} max={500} className="rounded border-2 px-2 py-1.5 font-mono text-[13px] w-24" style={{ borderColor: LINE }}
          value={qty} onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))} />
        <span className="font-mono text-[11px]" style={{ color: TEAL }}>= {total.toLocaleString()} peels</span>
        <div className="ml-auto flex gap-1.5">
          {(["1", "3"] as const).map(f => (
            <button key={f} onClick={() => setFmt(f)} className="px-2.5 py-1 rounded font-mono text-[10px] font-bold"
              style={{ background: fmt === f ? INK : "#F4EFE3", color: fmt === f ? "#fff" : "#3E3A30" }}>{f}-CONE</button>
          ))}
        </div>
      </div>

      {/* WORDS */}
      <p className={lab} style={{ color: "#3E3A30" }}>WORD LIST — STANDARD MIX {useStd ? "ON" : "OFF"} ({standardPool.length} words)
        <button onClick={() => setUseStd(!useStd)} className="ml-2 px-2 py-0.5 rounded font-mono text-[9px] font-bold"
          style={{ background: useStd ? TEAL : "#F4EFE3", color: useStd ? "#fff" : "#3E3A30" }}>{useStd ? "ON" : "OFF"}</button>
      </p>
      <div className="flex gap-1.5">
        <input className={inp} style={{ borderColor: wordInput ? (wordOk ? TEAL : RED) : LINE }}
          placeholder="ADD CUSTOM WORD (A–Z, ≤12)" value={wordInput}
          onChange={e => setWordInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addWord()} />
        <select className="rounded border-2 px-1 font-mono text-[10px]" style={{ borderColor: LINE }} value={cat} onChange={e => setCat(e.target.value)}>
          {CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={addWord} disabled={!wordOk} className="px-3 rounded font-mono text-[11px] font-bold disabled:opacity-40"
          style={{ background: INK, color: "#fff" }}>+</button>
      </div>
      {wordInput && !wordOk && <p className="font-mono text-[9px] mt-0.5" style={{ color: RED }}>
        {WordRe.test(wordUp) ? "already added" : "print-fit: A–Z only, max 12 characters — SeshSure has final veto"}</p>}
      {words.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {words.map(w => (
            <button key={w.word} onClick={() => setWords(words.filter(x => x.word !== w.word))}
              className="px-2 py-0.5 rounded font-mono text-[10px] font-bold"
              style={{ background: "#F4EFE3", color: INK }}>{w.word} ✕</button>
          ))}
        </div>
      )}

      {/* TIERS */}
      <p className={lab} style={{ color: "#3E3A30" }}>TIER COUNTS — MUST SUM TO {total.toLocaleString()} (INCL. 1 GOLDEN)</p>
      {tierRow("common", "COMMON")}{tierRow("uncommon", "UNCOMMON")}{tierRow("rare", "RARE")}{tierRow("epic", "EPIC")}{tierRow("legendary", "LEGENDARY")}
      <p className="font-mono text-[10px] mt-1 font-bold" style={{ color: tierSum === total ? TEAL : ORANGE }}>
        SUM {tierSum.toLocaleString()} / {total.toLocaleString()} {tierSum === total ? "✓" : `(${tierSum > total ? "over" : "under"} by ${Math.abs(total - tierSum).toLocaleString()})`}
      </p>
      <p className={lab} style={{ color: "#3E3A30" }}>PICKS (COMMA-SEPARATED, OPTIONAL — SESHSURE ASSIGNS THE REST)</p>
      <input className={inp} style={{ borderColor: LINE }} placeholder="rare picks" value={picks.rare} onChange={e => setPicks({ ...picks, rare: e.target.value })} />
      <input className={inp + " mt-1"} style={{ borderColor: LINE }} placeholder="epic picks" value={picks.epic} onChange={e => setPicks({ ...picks, epic: e.target.value })} />
      <input className={inp + " mt-1"} style={{ borderColor: LINE }} placeholder="legendary picks" value={picks.legendary} onChange={e => setPicks({ ...picks, legendary: e.target.value })} />
      <p className={lab} style={{ color: "#3E3A30" }}>GOLDEN WORD (EXACTLY ONE IN THE RUN — SYSTEM PLACES IT, NO HUMAN KNOWS WHERE)</p>
      <input className={inp} style={{ borderColor: golden ? (available.has(goldenUp) && WordRe.test(goldenUp) ? TEAL : RED) : LINE }}
        value={golden} onChange={e => setGolden(e.target.value)} placeholder="e.g. COSMIC" />
      {golden && !available.has(goldenUp) && <p className="font-mono text-[9px] mt-0.5" style={{ color: RED }}>not in your word set</p>}

      {/* HUNT SENTENCE */}
      <p className={lab} style={{ color: "#3E3A30" }}>LAUNCH HUNT SENTENCE (OPTIONAL — EVERY WORD MUST BE PRINTABLE IN THIS RUN)</p>
      <input className={inp} style={{ borderColor: sentence ? (badSentence.length === 0 ? TEAL : RED) : LINE }}
        value={sentence} onChange={e => setSentence(e.target.value)} placeholder="WE PUFF AND PASS THE GOOD VIBE" />
      {badSentence.length > 0 && <p className="font-mono text-[9px] mt-0.5" style={{ color: RED }}>not printable: {badSentence.join(", ")}</p>}

      {/* LOGISTICS */}
      <p className={lab} style={{ color: "#3E3A30" }}>ARTWORK ON DIELINE (PDF/AI)</p>
      <input type="file" accept=".pdf,.ai,.png" onChange={pickArt} className="font-mono text-[10px]" />
      {uploading && <p className="font-mono text-[9px]" style={{ color: "#5C574A" }}>uploading…</p>}
      {artPath && <p className="font-mono text-[9px]" style={{ color: TEAL }}>✓ artwork attached</p>}
      <p className={lab} style={{ color: "#3E3A30" }}>SHIP TO *</p>
      <input className={inp} style={{ borderColor: LINE }} value={shipTo} onChange={e => setShipTo(e.target.value)} placeholder="Company, street, city, state, zip" />
      <div className="flex gap-2">
        <div className="grow"><p className={lab} style={{ color: "#3E3A30" }}>NEEDED BY</p>
          <input type="date" className={inp} style={{ borderColor: LINE }} value={neededBy} onChange={e => setNeededBy(e.target.value)} /></div>
        <div className="grow"><p className={lab} style={{ color: "#3E3A30" }}>SALE STATES * (CO, CA…)</p>
          <input className={inp} style={{ borderColor: LINE }} value={states} onChange={e => setStates(e.target.value)} placeholder="CO, CA" /></div>
      </div>
      <p className={lab} style={{ color: "#3E3A30" }}>NOTES</p>
      <textarea className={inp} style={{ borderColor: LINE }} rows={2} value={notes} onChange={e => setNotes(e.target.value)} />

      <p className="font-mono text-[9px] mt-3" style={{ color: "#8B857A" }}>
        SESHSURE MATERIALS ONLY · APPLIED AT SESHSURE&apos;S FACILITY · NO OVERAGE IN CIRCULATION · LIVE HUNTS LOCK · POWERED-BY BADGE STAYS
      </p>
      <button onClick={submit}
        disabled={busy || tierSum !== total || !goldenUp || !available.has(goldenUp) || badSentence.length > 0 || shipTo.length < 6 || !states.trim()}
        className="mt-2 w-full py-3 rounded font-mono text-[12px] font-bold tracking-wider disabled:opacity-40"
        style={{ background: INK, color: "#FFFDF6", boxShadow: `4px 4px 0 ${TEAL}` }}>
        {busy ? "…" : "SUBMIT FOR REVIEW →"}
      </button>
      {err && <p className="font-mono text-[10px] mt-1" style={{ color: RED }}>{err}</p>}
    </div>
  );
}
