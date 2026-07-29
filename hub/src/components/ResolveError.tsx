"use client";
// Resolve = "seen and handled" for every occurrence of one error signature.
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResolveError({ signature }: { signature: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function resolve() {
    setBusy(true);
    await fetch("/api/admin/errors/resolve", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ signature }) });
    setBusy(false);
    router.refresh();
  }
  return (
    <button onClick={resolve} disabled={busy}
      className="shrink-0 px-3 py-1.5 rounded font-mono text-[10px] font-bold disabled:opacity-40"
      style={{ background: "#181818", color: "#fff" }}>
      {busy ? "…" : "RESOLVE"}
    </button>
  );
}
