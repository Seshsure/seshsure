"use client";
import { useState } from "react";

const CAUSES = [["factory_fault","FACTORY FAULT"],["freight_damage","FREIGHT DAMAGE"],["client_side","CLIENT-SIDE"],["no_fault_found","NO FAULT FOUND"],["goodwill","GOODWILL"]] as const;
const TYPES = [["replacement","REPLACEMENT"],["credit","FULL CREDIT"],["partial_credit","PARTIAL CREDIT"],["refund","REFUND"],["denied","DENY"]] as const;

export function ResolvePanel({ disputeId }: { disputeId: string }) {
  const [cause, setCause] = useState<string | null>(null);
  const [scope, setScope] = useState<"order_specific"|"lot_wide">("order_specific");
  const [type, setType] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [state, setState] = useState<"idle"|"busy"|"done"|"err">("idle");
  const [msg, setMsg] = useState("");
  const needsValue = type === "credit" || type === "partial_credit" || type === "refund";

  async function resolve() {
    setState("busy"); setMsg("");
    const r = await fetch("/api/disputes/resolve", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        disputeId, rootCause: cause, defectScope: scope, resolutionType: type,
        resolutionValueCents: needsValue ? String(Math.round(parseFloat(value || "0") * 100)) : undefined,
      }) });
    const j = await r.json();
    if (!r.ok) { setState("err"); setMsg(typeof j.error === "string" ? j.error : "check inputs"); return; }
    setState("done");
  }

  if (state === "done") return (
    <p className="mt-3 py-3 text-center rounded-lg border text-[12px] font-bold" style={{ background: "#14181B", borderColor: "#2DD4BF44", color: "#2DD4BF" }}>
      ✓ Ruled — client notified, collections resume, ledger updated
    </p>
  );

  const Chip = ({ on, label, onTap, danger }: { on: boolean; label: string; onTap: () => void; danger?: boolean }) => (
    <button onClick={onTap} className="font-mono text-[8px] font-bold px-2 py-1.5 rounded border"
      style={{ background: on ? (danger ? "#E5484D" : "#2DD4BF") : "transparent", color: on ? "#0C0F11" : "#8B949C", borderColor: on ? (danger ? "#E5484D" : "#2DD4BF") : "#262C31" }}>
      {label}
    </button>
  );

  return (
    <div className="mt-3 rounded-lg border overflow-hidden" style={{ background: "#14181B", borderColor: "#262C31" }}>
      <div className="px-3 py-2 border-b" style={{ borderColor: "#262C31" }}>
        <span className="font-mono text-[9px] font-bold" style={{ color: "#8B949C" }}>YOUR RULING — ROOT CAUSE + SCOPE REQUIRED</span>
      </div>
      <div className="px-3 py-2.5 border-b" style={{ borderColor: "#262C31" }}>
        <p className="font-mono text-[7px] font-bold mb-1.5" style={{ color: "#5C666D" }}>ROOT CAUSE (FEEDS SCORECARDS — ONLY FACTORY FAULT COUNTS AGAINST THEM)</p>
        <div className="flex gap-1.5 flex-wrap">{CAUSES.map(([v, l]) => <Chip key={v} on={cause === v} label={l} onTap={() => setCause(v)} />)}</div>
      </div>
      <div className="px-3 py-2.5 border-b" style={{ borderColor: "#262C31" }}>
        <p className="font-mono text-[7px] font-bold mb-1.5" style={{ color: "#5C666D" }}>DEFECT SCOPE (LOT-WIDE TRIGGERS BLAST-RADIUS OUTREACH TASK)</p>
        <div className="flex gap-1.5">
          <Chip on={scope === "order_specific"} label="THIS ORDER ONLY" onTap={() => setScope("order_specific")} />
          <Chip on={scope === "lot_wide"} label="LOT-WIDE 💥" onTap={() => setScope("lot_wide")} danger />
        </div>
      </div>
      <div className="px-3 py-2.5 border-b" style={{ borderColor: "#262C31" }}>
        <p className="font-mono text-[7px] font-bold mb-1.5" style={{ color: "#5C666D" }}>RESOLUTION (FACTORY-FAULT REPLACEMENT = $0 RUN, FACTORY PAYS)</p>
        <div className="flex gap-1.5 flex-wrap">{TYPES.map(([v, l]) => <Chip key={v} on={type === v} label={l} onTap={() => setType(v)} danger={v === "denied"} />)}</div>
        {needsValue && (
          <input value={value} onChange={e => setValue(e.target.value.replace(/[^\d.]/g,""))} placeholder="Credit amount ($)"
            inputMode="decimal" className="w-full mt-2 px-3 py-2 rounded font-mono text-[12px] border outline-none"
            style={{ background: "#0C0F11", borderColor: "#262C31", color: "#E8EAEC" }} />
        )}
      </div>
      <div className="p-3">
        <button onClick={resolve} disabled={state === "busy" || !cause || !type || (needsValue && !parseFloat(value))}
          className="w-full py-3 rounded-lg font-bold text-[13px] disabled:opacity-50" style={{ background: "#2DD4BF", color: "#0C0F11" }}>
          {state === "busy" ? "Ruling…" : "Rule & close"}
        </button>
        {state === "err" && <p className="font-mono text-[9px] mt-2" style={{ color: "#E5484D" }}>{msg}</p>}
      </div>
    </div>
  );
}
