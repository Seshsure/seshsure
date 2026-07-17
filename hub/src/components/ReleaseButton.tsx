"use client";
import { useState } from "react";

export function ReleaseButton({ expectedTotalCents }: { expectedTotalCents: string }) {
  const [stage, setStage] = useState<"idle"|"confirm"|"busy"|"done"|"err">("idle");
  const [msg, setMsg] = useState("");

  async function release() {
    setStage("busy");
    const r = await fetch("/api/batch/release", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: true, expectedTotalCents }) });
    const j = await r.json();
    if (!r.ok) { setStage("err"); setMsg(j.error ?? "release failed"); return; }
    setStage("done");
    setMsg(`✓ Batch released — ${j.entries} debits`);
  }

  if (stage === "done") return <p className="mt-3 text-center text-[13px] font-bold" style={{ color: "#2DD4BF" }}>{msg}</p>;
  return (
    <div className="mt-3">
      {stage === "confirm" ? (
        <div className="flex gap-2">
          <button onClick={() => setStage("idle")} className="flex-1 py-3 rounded-lg font-bold text-[12px] border" style={{ borderColor: "#262C31", color: "#8B949C" }}>Back</button>
          <button onClick={release} className="flex-[2] py-3 rounded-lg font-bold text-[12px]" style={{ background: "#2DD4BF", color: "#0C0F11" }}>
            {stage === "confirm" ? "CONFIRM — send to bank" : "…"}
          </button>
        </div>
      ) : (
        <button onClick={() => setStage("confirm")} disabled={stage === "busy"}
          className="w-full py-3 rounded-lg font-bold text-[13px]" style={{ background: "#E8EAEC", color: "#0C0F11" }}>
          {stage === "busy" ? "Building NACHA…" : "Release today's batch"}
        </button>
      )}
      {stage === "err" && <p className="font-mono text-[9px] mt-2" style={{ color: "#E5484D" }}>{msg}</p>}
    </div>
  );
}
