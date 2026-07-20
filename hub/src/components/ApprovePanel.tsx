"use client";
import { useState } from "react";

type F = { id: string; name: string; rateMicro: string | null; onTime: string; load: number; eligible: boolean };

export function ApprovePanel({ orderId, defaultDeposit, isFlagship, factories }:
  { orderId: string; defaultDeposit: number; isFlagship: boolean; factories: F[] }) {
  const [deposit, setDeposit] = useState(defaultDeposit);
  const [routing, setRouting] = useState<"assign"|"board">("assign");
  const [factoryId, setFactoryId] = useState<string | null>(factories.find(f => f.eligible)?.id ?? null);
  const [state, setState] = useState<"idle"|"busy"|"done"|"err">("idle");
  const [msg, setMsg] = useState("");

  async function approve() {
    setState("busy"); setMsg("");
    const r = await fetch("/api/orders/approve", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId, depositPct: deposit, factoryId: routing === "assign" ? factoryId : undefined, postToBoard: routing === "board" }) });
    const j = await r.json();
    if (!r.ok) { setState("err"); setMsg(j.error ?? "blocked"); return; }
    setState("done");
    setMsg(`✓ ${j.orderNumber} approved${j.invoiceNumber ? ` · deposit invoice ${j.invoiceNumber} sent` : " · production starts now"}${j.postedToBoard ? " · posted to the Run Board" : ""}`);
  }

  return (
    <div className="mt-4 rounded-lg border overflow-hidden" style={{ background: "#FFFFFF", borderColor: "#E7DFCE" }}>
      <div className="px-3 py-2 border-b" style={{ borderColor: "#E7DFCE" }}>
        <span className="text-[10px] font-mono font-bold" style={{ color: "#6E6A5E" }}>DEPOSIT</span>
      </div>
      <div className="flex gap-1.5 px-3 py-2.5">
        {[0, 25, 50, 100].map(p => (
          <button key={p} onClick={() => setDeposit(p)} className="flex-1 py-2 rounded-md font-mono text-[10px] font-bold border"
            style={{ background: deposit === p ? "#0D9488" : "transparent", color: deposit === p ? "#FAF5EA" : "#6E6A5E", borderColor: deposit === p ? "#0D9488" : "#E7DFCE" }}>
            {p === 0 ? "0% — START NOW" : `${p}%`}
          </button>
        ))}
      </div>

      <div className="px-3 py-2 border-y" style={{ borderColor: "#E7DFCE" }}>
        <span className="text-[10px] font-mono font-bold" style={{ color: "#6E6A5E" }}>ROUTING</span>
      </div>
      <div className="flex gap-1.5 px-3 py-2.5">
        <button onClick={() => setRouting("assign")} className="flex-1 py-2 rounded-md font-mono text-[10px] font-bold border"
          style={{ background: routing === "assign" ? "#181818" : "transparent", color: routing === "assign" ? "#FAF5EA" : "#6E6A5E", borderColor: "#E7DFCE" }}>
          ASSIGN FACTORY
        </button>
        <button onClick={() => !isFlagship && setRouting("board")} disabled={isFlagship}
          className="flex-1 py-2 rounded-md font-mono text-[10px] font-bold border disabled:opacity-40"
          style={{ background: routing === "board" ? "#181818" : "transparent", color: routing === "board" ? "#FAF5EA" : "#6E6A5E", borderColor: "#E7DFCE" }}>
          {isFlagship ? "BOARD — BLOCKED (FLAGSHIP)" : "POST TO RUN BOARD"}
        </button>
      </div>
      {routing === "assign" && factories.map(f => (
        <button key={f.id} onClick={() => f.eligible && setFactoryId(f.id)} disabled={!f.eligible}
          className="w-full flex items-center px-3 py-2.5 border-b text-left disabled:opacity-40"
          style={{ borderColor: "#E7DFCE", background: factoryId === f.id ? "#0D948810" : "transparent" }}>
          <div className="w-3.5 h-3.5 rounded-full mr-3 border-2 flex items-center justify-center" style={{ borderColor: factoryId === f.id ? "#0D9488" : "#3A424A" }}>
            {factoryId === f.id && <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#0D9488" }} />}
          </div>
          <div className="flex-1">
            <p className="text-[12px] font-semibold" style={{ color: "#181818" }}>{f.name}{!f.eligible ? " — NOT FLAGSHIP-APPROVED" : ""}</p>
            <p className="font-mono text-[8px]" style={{ color: "#9B9484" }}>
              {f.rateMicro ? `${(Number(f.rateMicro)/10000).toFixed(2)}¢/CONE` : "NO RATE ON FILE"} · ON-TIME {f.onTime} · {f.load} OPEN RUNS
            </p>
          </div>
        </button>
      ))}

      <div className="p-3">
        {state === "done"
          ? <p className="text-[12px] font-bold text-center py-1" style={{ color: "#0D9488" }}>{msg}</p>
          : <>
              <button onClick={approve} disabled={state === "busy" || (routing === "assign" && !factoryId)}
                className="w-full py-3 rounded-lg font-bold text-[13px] disabled:opacity-50" style={{ background: "#0D9488", color: "#FAF5EA" }}>
                {state === "busy" ? "Checking floors…" : "Approve order"}
              </button>
              {state === "err" && <p className="font-mono text-[9px] mt-2" style={{ color: "#C77800" }}>{msg}</p>}
            </>}
      </div>
    </div>
  );
}
