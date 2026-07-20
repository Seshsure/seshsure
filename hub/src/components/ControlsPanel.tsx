"use client";
import { useState } from "react";

type Controls = {
  accepted_methods: string[]; auto_hold: boolean; hold_active: boolean; absorb_card_fee: boolean;
  deposit_pct: number; credit_ceiling_cents: string | null; expected_reorder_weeks: number; watch_flag: boolean;
};
const ALL_METHODS = ["ach","wire","check","cash","card"];

export function ControlsPanel({ clientId, initial }: { clientId: string; initial: Controls }) {
  const [c, setC] = useState(initial);
  const [msg, setMsg] = useState("");

  async function save(patch: Partial<Controls>) {
    setC({ ...c, ...patch }); setMsg("");
    const r = await fetch("/api/client-controls", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId, patch }) });
    const j = await r.json();
    setMsg(r.ok ? "✓ saved & logged" : j.error ?? "failed");
  }

  const Toggle = ({ label, sub, value, onFlip, danger }: { label: string; sub: string; value: boolean; onFlip: (v: boolean) => void; danger?: boolean }) => (
    <button onClick={() => onFlip(!value)} className="w-full flex items-center px-3 py-3 border-b text-left" style={{ borderColor: "#E7DFCE" }}>
      <div className="flex-1">
        <p className="text-[14px] font-semibold" style={{ color: "#181818" }}>{label}</p>
        <p className="font-mono text-[10px] mt-0.5" style={{ color: "#5C574A" }}>{sub}</p>
      </div>
      <div className="w-9 h-5 rounded-full p-0.5 transition-colors" style={{ background: value ? (danger ? "#E63946" : "#0D9488") : "#E7DFCE" }}>
        <div className="w-4 h-4 rounded-full transition-transform" style={{ background: "#181818", transform: value ? "translateX(16px)" : "none" }} />
      </div>
    </button>
  );

  return (
    <div className="mt-3 rounded-lg border overflow-hidden" style={{ background: "#FFFFFF", borderColor: "#E7DFCE" }}>
      <div className="px-3 py-2 border-b flex justify-between" style={{ borderColor: "#E7DFCE" }}>
        <span className="font-mono text-[12px] font-bold" style={{ color: "#3E3A30" }}>CLIENT CONTROLS — EVERY FLIP AUDITED</span>
        {msg && <span className="font-mono text-[11px]" style={{ color: msg.startsWith("✓") ? "#0D9488" : "#E63946" }}>{msg}</span>}
      </div>

      <div className="px-3 py-3 border-b" style={{ borderColor: "#E7DFCE" }}>
        <p className="font-mono text-[10px] font-bold mb-1.5" style={{ color: "#5C574A" }}>PAYMENT METHODS</p>
        <div className="flex gap-1.5 flex-wrap">
          {ALL_METHODS.map(m => {
            const on = c.accepted_methods.includes(m);
            return (
              <button key={m} onClick={() => {
                const next = on ? c.accepted_methods.filter(x => x !== m) : [...c.accepted_methods, m];
                if (next.length) save({ accepted_methods: next });
              }} className="font-mono text-[11px] font-bold px-2.5 py-1.5 rounded border"
                style={{ background: on ? "#0D9488" : "transparent", color: on ? "#FAF5EA" : "#3E3A30", borderColor: on ? "#0D9488" : "#E7DFCE" }}>
                {m.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      <Toggle label="Hold — pause ordering NOW" sub="MANUAL FREEZE, INDEPENDENT OF THE AUTOMATIC LADDER" value={c.hold_active} onFlip={v => save({ hold_active: v })} danger />
      <Toggle label="Auto-hold at final notice" sub="21-DAY LADDER STEP LOCKS ORDERING AUTOMATICALLY" value={c.auto_hold} onFlip={v => save({ auto_hold: v })} />
      <Toggle label="Absorb card fees" sub="RELATIONSHIP COST — SHOWS IN PER-CLIENT MARGIN" value={c.absorb_card_fee} onFlip={v => save({ absorb_card_fee: v })} />
      <Toggle label="Watch flag" sub="EXTRA EYES AFTER RETURNS / DISPUTES" value={c.watch_flag} onFlip={v => save({ watch_flag: v })} />

      <div className="px-3 py-3 border-b" style={{ borderColor: "#E7DFCE" }}>
        <p className="font-mono text-[10px] font-bold mb-1.5" style={{ color: "#5C574A" }}>DEFAULT DEPOSIT</p>
        <div className="flex gap-1.5">
          {[0, 25, 50, 100].map(p => (
            <button key={p} onClick={() => save({ deposit_pct: p })} className="flex-1 py-1.5 rounded font-mono text-[11px] font-bold border"
              style={{ background: c.deposit_pct === p ? "#181818" : "transparent", color: c.deposit_pct === p ? "#FAF5EA" : "#3E3A30", borderColor: "#E7DFCE" }}>
              {p}%
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 py-3 grid grid-cols-2 gap-3">
        <div>
          <p className="font-mono text-[10px] font-bold mb-1" style={{ color: "#5C574A" }}>CREDIT CEILING ($, BLANK = NONE)</p>
          <input defaultValue={c.credit_ceiling_cents ? String(Number(c.credit_ceiling_cents) / 100) : ""}
            onBlur={e => { const v = e.target.value.replace(/[^\d]/g, ""); save({ credit_ceiling_cents: v ? String(Number(v) * 100) : null }); }}
            inputMode="numeric" className="w-full px-2.5 py-2 rounded font-mono text-[13px] border outline-none"
            style={{ background: "#FAF5EA", borderColor: "#E7DFCE", color: "#181818" }} />
        </div>
        <div>
          <p className="font-mono text-[10px] font-bold mb-1" style={{ color: "#5C574A" }}>EXPECTED REORDER (WEEKS)</p>
          <input defaultValue={c.expected_reorder_weeks}
            onBlur={e => { const v = parseInt(e.target.value); if (v > 0) save({ expected_reorder_weeks: v }); }}
            inputMode="numeric" className="w-full px-2.5 py-2 rounded font-mono text-[13px] border outline-none"
            style={{ background: "#FAF5EA", borderColor: "#E7DFCE", color: "#181818" }} />
        </div>
      </div>
    </div>
  );
}
