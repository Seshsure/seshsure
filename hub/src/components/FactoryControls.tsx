"use client";
import { useState } from "react";

type C = { board_eligible: boolean; flagship_approved: boolean; is_active: boolean };

export function FactoryControls({ factoryId, initial, qualified }: { factoryId: string; initial: C; qualified: boolean }) {
  const [c, setC] = useState(initial);
  const [msg, setMsg] = useState("");

  async function flip(patch: Partial<C>) {
    setMsg("");
    const r = await fetch("/api/factory-controls", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ factoryId, patch }) });
    const j = await r.json();
    if (!r.ok) { setMsg(j.error ?? "blocked"); return; }
    setC({ ...c, ...patch }); setMsg("✓ saved & logged");
  }

  const Row = ({ label, sub, value, onFlip, danger, disabled }: { label: string; sub: string; value: boolean; onFlip: (v: boolean) => void; danger?: boolean; disabled?: boolean }) => (
    <button onClick={() => !disabled && onFlip(!value)} disabled={disabled}
      className="w-full flex items-center px-3 py-3 border-b text-left disabled:opacity-40" style={{ borderColor: "#262C31" }}>
      <div className="flex-1">
        <p className="text-[12px] font-semibold" style={{ color: "#E8EAEC" }}>{label}</p>
        <p className="font-mono text-[8px] mt-0.5" style={{ color: "#5C666D" }}>{sub}</p>
      </div>
      <div className="w-9 h-5 rounded-full p-0.5" style={{ background: value ? (danger ? "#E5484D" : "#2DD4BF") : "#262C31" }}>
        <div className="w-4 h-4 rounded-full" style={{ background: "#E8EAEC", transform: value ? "translateX(16px)" : "none" }} />
      </div>
    </button>
  );

  return (
    <div className="mt-3 rounded-lg border overflow-hidden" style={{ background: "#14181B", borderColor: "#262C31" }}>
      <div className="px-3 py-2 border-b flex justify-between" style={{ borderColor: "#262C31" }}>
        <span className="font-mono text-[10px] font-bold" style={{ color: "#8B949C" }}>QUALIFICATION — YOUR FLIPS, AUDITED</span>
        {msg && <span className="font-mono text-[8px]" style={{ color: msg.startsWith("✓") ? "#2DD4BF" : "#E5484D" }}>{msg}</span>}
      </div>
      <Row label="Board eligible" sub={qualified ? "QUALIFICATION RUN ON RECORD — CLEAR TO FLIP" : "BLOCKED: NO COMPLETED QUALIFICATION RUN"} value={c.board_eligible} onFlip={v => flip({ board_eligible: v })} disabled={!qualified && !c.board_eligible} />
      <Row label="Flagship approved" sub="ONLY FLAGSHIP-APPROVED FACTORIES CAN EVER TOUCH THE PATENTED CONE" value={c.flagship_approved} onFlip={v => flip({ flagship_approved: v })} />
      <Row label="Active" sub="INACTIVE = NO NEW RUNS ROUTE HERE" value={c.is_active} onFlip={v => flip({ is_active: v })} danger={!c.is_active} />
    </div>
  );
}
