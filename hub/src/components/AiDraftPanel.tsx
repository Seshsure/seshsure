"use client";
// Read-and-draft: the machine writes, you edit, YOU copy/send. Nothing auto-sends.
import { useState } from "react";

const TASK_LABEL: Record<string, string> = {
  dispute_client_reply: "✍ Draft client reply",
  dispute_factory_note: "✍ Draft factory note",
  collections_note: "✍ Draft collections note",
  supplier_message: "✍ Draft supplier message",
};

export function AiDraftPanel({ tasks, entityId }: { tasks: string[]; entityId?: string }) {
  const [active, setActive] = useState<string | null>(null);
  const [steer, setSteer] = useState("");
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<"idle"|"busy"|"err">("idle");
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);

  async function run(task: string) {
    setActive(task); setState("busy"); setMsg(""); setDraft(""); setCopied(false);
    const r = await fetch("/api/ai/draft", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ task, entityId, freeContext: steer || undefined }) });
    const j = await r.json();
    if (!r.ok) { setState("err"); setMsg(j.error ?? "draft failed"); return; }
    setDraft(j.draft); setState("idle");
  }

  async function copy() {
    await navigator.clipboard.writeText(draft);
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="mt-3 rounded-lg border overflow-hidden" style={{ background: "#FFFFFF", borderColor: "#E7DFCE" }}>
      <div className="px-3 py-2 border-b" style={{ borderColor: "#E7DFCE" }}>
        <span className="font-mono text-[10px] font-bold" style={{ color: "#514C41" }}>AI DRAFTING — READS THE RECORD, WRITES IN YOUR VOICE, NEVER SENDS</span>
      </div>
      <div className="px-3 py-2.5 border-b" style={{ borderColor: "#E7DFCE" }}>
        <input value={steer} onChange={e => setSteer(e.target.value)} placeholder="Optional steering: 'be extra warm, mention the replacement ships Friday'…"
          className="w-full px-3 py-2 rounded font-mono text-[10px] border outline-none"
          style={{ background: "#FAF5EA", borderColor: "#E7DFCE", color: "#181818" }} />
      </div>
      <div className="flex gap-1.5 flex-wrap px-3 py-2.5 border-b" style={{ borderColor: "#E7DFCE" }}>
        {tasks.map(t => (
          <button key={t} onClick={() => run(t)} disabled={state === "busy"}
            className="font-mono text-[8px] font-bold px-2.5 py-2 rounded border disabled:opacity-50"
            style={{ background: active === t ? "#0D9488" : "transparent", color: active === t ? "#FAF5EA" : "#514C41", borderColor: active === t ? "#0D9488" : "#E7DFCE" }}>
            {state === "busy" && active === t ? "DRAFTING…" : TASK_LABEL[t] ?? t}
          </button>
        ))}
      </div>
      {(draft || state === "err") && (
        <div className="px-3 py-3">
          {state === "err"
            ? <p className="font-mono text-[9px]" style={{ color: "#C77800" }}>{msg}</p>
            : <>
                <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={9}
                  className="w-full px-3 py-2.5 rounded font-mono text-[10px] leading-relaxed border outline-none"
                  style={{ background: "#FAF5EA", borderColor: "#E7DFCE", color: "#181818" }} />
                <div className="flex gap-2 mt-2">
                  <button onClick={copy} className="flex-1 py-2.5 rounded font-bold text-[11px]"
                    style={{ background: copied ? "#0D9488" : "#181818", color: "#FAF5EA" }}>
                    {copied ? "✓ Copied" : "Copy to send yourself"}
                  </button>
                </div>
                <p className="font-mono text-[7px] mt-2" style={{ color: "#7A7365" }}>
                  EDIT FREELY — THIS IS A DRAFT, NOT A DECISION. SEND FROM YOUR OWN EMAIL/WHATSAPP.
                </p>
              </>}
        </div>
      )}
    </div>
  );
}
