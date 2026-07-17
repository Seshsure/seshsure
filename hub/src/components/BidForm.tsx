"use client";
import { useState } from "react";

export function BidForm({ postId }: { postId: string }) {
  const [price, setPrice] = useState("");
  const [promise, setPromise] = useState("");
  const [state, setState] = useState<"idle"|"busy"|"done"|"declined">("idle");

  async function submit(decline: boolean) {
    setState("busy");
    await fetch("/api/board", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(decline
        ? { postId, decline: true, declineReason: "capacity" }
        : { postId, pricePerConeCents: price, promiseDate: promise || undefined }) });
    setState(decline ? "declined" : "done");
  }

  if (state === "done") return <p className="font-mono text-[10px] mt-2 font-bold" style={{ color: "#0D9488" }}>✓ BID SEALED & SENT</p>;
  if (state === "declined") return <p className="font-mono text-[10px] mt-2" style={{ color: "#6E756B" }}>DECLINED</p>;

  return (
    <div className="flex gap-2 mt-2 items-end">
      <div className="flex-1">
        <label className="text-[8px] font-mono font-bold" style={{ color: "#6E756B" }}>¢/CONE</label>
        <input value={price} onChange={e => setPrice(e.target.value.replace(/[^\d.]/g,""))} placeholder="2.85"
          inputMode="decimal" className="w-full px-3 py-2 rounded-md border font-mono text-[12px]" style={{ borderColor: "#E4E1DA" }} />
      </div>
      <div className="flex-1">
        <label className="text-[8px] font-mono font-bold" style={{ color: "#6E756B" }}>SHIP BY</label>
        <input type="date" value={promise} onChange={e => setPromise(e.target.value)}
          className="w-full px-3 py-2 rounded-md border font-mono text-[10px]" style={{ borderColor: "#E4E1DA" }} />
      </div>
      <button onClick={() => submit(false)} disabled={state === "busy" || !parseFloat(price)}
        className="px-4 py-2 rounded-md font-bold text-[11px] disabled:opacity-50" style={{ background: "#15181A", color: "#fff" }}>Bid</button>
      <button onClick={() => submit(true)} disabled={state === "busy"}
        className="px-3 py-2 rounded-md font-bold text-[11px] border" style={{ borderColor: "#E4E1DA", color: "#6E756B" }}>Pass</button>
    </div>
  );
}
