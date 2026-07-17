"use client";
import { useState } from "react";

export function FactoryRespond({ disputeId }: { disputeId: string }) {
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle"|"busy"|"done">("idle");
  async function send() {
    setState("busy");
    await fetch("/api/disputes/factory-respond", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ disputeId, response: text }) });
    setState("done");
  }
  if (state === "done") return <p className="text-[10px] font-mono mt-2" style={{ color: "#0D9488" }}>✓ SENT TO SESHSURE</p>;
  return (
    <div className="mt-2">
      <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
        placeholder="Your side: lot QC records, press settings, what you see in the photos…"
        className="w-full px-3 py-2 rounded-md border text-[11px]" style={{ borderColor: "#E4E1DA" }} />
      <button onClick={send} disabled={state === "busy" || text.length < 10}
        className="mt-1.5 px-4 py-2 rounded-md font-bold text-[11px] disabled:opacity-50"
        style={{ background: "#15181A", color: "#fff" }}>
        Send response to SeshSure
      </button>
    </div>
  );
}
