"use client";
import { useState } from "react";

export function FactoryOnboardWizard({ factoryId, termsDone, specDone, docKeys, specs }: {
  factoryId: string; termsDone: boolean; specDone: boolean; docKeys: string[];
  specs: { id: string; title: string; version: number }[];
}) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [tState, setTState] = useState<"idle"|"busy"|"done">(termsDone ? "done" : "idle");
  const [sState, setSState] = useState<"idle"|"busy"|"done">(specDone ? "done" : "idle");
  const [checked, setChecked] = useState<string[]>([]);

  async function signTerms() {
    setTState("busy");
    await fetch("/api/factory-onboarding", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ step: "terms", factoryId, signerName: name, signerTitle: title, acceptedDocKeys: docKeys }) });
    setTState("done");
  }
  async function ackSpecs() {
    setSState("busy");
    await fetch("/api/factory-onboarding", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ step: "spec_ack", factoryId, specVersionIds: checked }) });
    setSState("done");
  }

  const card = "rounded-xl border p-4 mt-4";

  return (
    <>
      <div className={card} style={{ background: "#fff", borderColor: "#E7DFCE" }}>
        <p className="font-mono text-[9px] font-bold" style={{ color: "#6E6A5E" }}>STEP 1 — AGREEMENTS</p>
        <p className="text-[10px] mt-1" style={{ color: "#6E6A5E" }}>
          NDA, non-circumvention, and services terms. Typing your name below is your electronic signature; time, IP, and device are recorded.
        </p>
        {tState === "done" ? <p className="font-mono text-[10px] font-bold mt-3" style={{ color: "#0D9488" }}>✓ SIGNED & ON FILE</p> : (
          <>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <label className="text-[8px] font-mono font-bold" style={{ color: "#6E6A5E" }}>FULL LEGAL NAME</label>
                <input value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 px-3 py-2.5 rounded-lg border text-[13px]" style={{ borderColor: "#E7DFCE" }} />
              </div>
              <div>
                <label className="text-[8px] font-mono font-bold" style={{ color: "#6E6A5E" }}>TITLE</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Director" className="w-full mt-1 px-3 py-2.5 rounded-lg border text-[13px]" style={{ borderColor: "#E7DFCE" }} />
              </div>
            </div>
            <button onClick={signTerms} disabled={tState === "busy" || name.length < 3 || title.length < 2}
              className="w-full mt-3 py-3 rounded-lg font-bold text-[12px] disabled:opacity-50" style={{ background: "#181818", color: "#fff" }}>
              {tState === "busy" ? "…" : "Sign agreements"}
            </button>
          </>
        )}
      </div>

      <div className={card} style={{ background: "#fff", borderColor: "#E7DFCE", opacity: tState === "done" ? 1 : 0.5 }}>
        <p className="font-mono text-[9px] font-bold" style={{ color: "#6E6A5E" }}>STEP 2 — PRODUCT SPEC ACKNOWLEDGMENT</p>
        <p className="text-[10px] mt-1" style={{ color: "#6E6A5E" }}>
          Confirm you&apos;ve read the current specs. Runs are QC&apos;d against exactly these versions.
        </p>
        {sState === "done" ? <p className="font-mono text-[10px] font-bold mt-3" style={{ color: "#0D9488" }}>✓ ACKNOWLEDGED</p> : (
          <>
            {specs.map(s => (
              <label key={s.id} className="flex items-center mt-2">
                <input type="checkbox" checked={checked.includes(s.id)} disabled={tState !== "done"}
                  onChange={e => setChecked(e.target.checked ? [...checked, s.id] : checked.filter(x => x !== s.id))}
                  className="mr-2" />
                <span className="text-[11px]" style={{ color: "#181818" }}>{s.title} <span className="font-mono text-[8px]" style={{ color: "#9B9484" }}>v{s.version}</span></span>
              </label>
            ))}
            {!specs.length && <p className="text-[10px] mt-2" style={{ color: "#9B9484" }}>Specs will appear here when SeshSure publishes them.</p>}
            <button onClick={ackSpecs} disabled={sState === "busy" || tState !== "done" || !checked.length}
              className="w-full mt-3 py-3 rounded-lg font-bold text-[12px] disabled:opacity-50" style={{ background: "#181818", color: "#fff" }}>
              {sState === "busy" ? "…" : "Acknowledge specs"}
            </button>
          </>
        )}
      </div>

      {tState === "done" && sState === "done" && (
        <p className="text-center font-mono text-[9px] mt-4" style={{ color: "#0D9488" }}>
          ✓ YOUR SIDE IS COMPLETE — SESHSURE FINALIZES TERMS & RATES, THEN YOUR FIRST RUN APPEARS UNDER RUNS
        </p>
      )}
    </>
  );
}
