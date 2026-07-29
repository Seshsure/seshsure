"use client";
// Approve is disabled until a rules-doc path and slug exist — the same gate
// the API enforces, mirrored so the owner can't tap into an error.
import { useState } from "react";
import { useRouter } from "next/navigation";

const INK = "#181818", TEAL = "#0D9488", RED = "#D62839", LINE = "#E7DFCE", ORANGE = "#B45309", PURPLE = "#6C4AB0";

type Row = {
  client_id: string; status: string; applied_at: string;
  application_note: string | null; arcade_slug: string | null; rules_doc_path: string | null;
  clients: unknown;
};

export function ArcadeAccessCard({ row }: { row: Row }) {
  const c = row.clients as unknown as { legal_name: string; dba: string | null } | null;
  const name = c?.dba ?? c?.legal_name ?? "Client";
  const [rulesDoc, setRulesDoc] = useState(row.rules_doc_path ?? "");
  const [slug, setSlug] = useState(row.arcade_slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();

  async function act(action: string) {
    setErr(""); setBusy(true);
    const res = await fetch("/api/arcade/access", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, clientId: row.client_id,
        rulesDocPath: action === "approve" ? rulesDoc : undefined,
        slug: action === "approve" ? slug : undefined }) });
    setBusy(false);
    if (!res.ok) { setErr((await res.json()).error ?? "failed"); return; }
    router.refresh();
  }

  const tone = row.status === "approved" ? TEAL : row.status === "applied" ? PURPLE : row.status === "suspended" ? ORANGE : "#5C574A";

  return (
    <div className="rounded-lg border-2 p-3 mb-3 bg-white" style={{ borderColor: row.status === "applied" ? PURPLE : LINE }}>
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-bold" style={{ color: INK }}>{name}</p>
        <span className="font-mono text-[9px] font-bold px-2 py-0.5 rounded" style={{ background: tone + "15", color: tone }}>
          {row.status.toUpperCase()}{row.arcade_slug ? ` · /${row.arcade_slug}` : ""}
        </span>
      </div>
      {row.application_note && <p className="text-[12px] italic mt-1" style={{ color: "#3E3A30" }}>&ldquo;{row.application_note}&rdquo;</p>}

      {row.status === "applied" && (
        <div className="mt-2">
          <p className="font-mono text-[9px] font-bold" style={{ color: "#3E3A30" }}>SWEEPSTAKES RULES DOC (STORAGE PATH) — REQUIRED TO APPROVE</p>
          <input className="w-full rounded border-2 px-2 py-1.5 font-mono text-[11px] mt-0.5" style={{ borderColor: rulesDoc ? TEAL : LINE }}
            placeholder="legal/sweepstakes-rules-{client}.pdf" value={rulesDoc} onChange={e => setRulesDoc(e.target.value)} />
          <p className="font-mono text-[9px] font-bold mt-2" style={{ color: "#3E3A30" }}>ARCADE SLUG</p>
          <input className="w-full rounded border-2 px-2 py-1.5 font-mono text-[11px] mt-0.5" style={{ borderColor: LINE }}
            value={slug} onChange={e => setSlug(e.target.value.toLowerCase())} />
          <div className="flex gap-2 mt-2">
            <button onClick={() => act("approve")} disabled={busy || !rulesDoc || !/^[a-z0-9-]{3,40}$/.test(slug)}
              className="grow py-2 rounded font-mono text-[10px] font-bold disabled:opacity-40" style={{ background: TEAL, color: "#fff" }}>
              APPROVE + OPEN ARCADE
            </button>
            <button onClick={() => act("deny")} disabled={busy}
              className="px-4 py-2 rounded font-mono text-[10px] font-bold disabled:opacity-40"
              style={{ background: "#fff", color: RED, border: `2px solid ${RED}` }}>DENY</button>
          </div>
        </div>
      )}
      {row.status === "approved" && (
        <button onClick={() => act("suspend")} disabled={busy}
          className="mt-2 px-3 py-1.5 rounded font-mono text-[9px] font-bold"
          style={{ background: "#fff", color: ORANGE, border: `2px solid ${ORANGE}` }}>SUSPEND</button>
      )}
      {row.status === "suspended" && (
        <button onClick={() => act("reinstate")} disabled={busy}
          className="mt-2 px-3 py-1.5 rounded font-mono text-[9px] font-bold"
          style={{ background: INK, color: "#fff" }}>REINSTATE</button>
      )}
      {err && <p className="font-mono text-[10px] mt-1" style={{ color: RED }}>{err}</p>}
    </div>
  );
}
