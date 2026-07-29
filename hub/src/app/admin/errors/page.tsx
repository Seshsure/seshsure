// ————— ERRORS DASHBOARD — the pager's landing page —————
// The alert email says something broke; this page says what, how often,
// and whether it's still burning. Grouped by signature so a crash loop
// reads as one row with a count, not four hundred rows. RLS (internal-only)
// enforces access; the layout's role gate covers the route.
import { supabaseServer } from "@/lib/supabase-server";
import { ResolveError } from "@/components/ResolveError";

export const dynamic = "force-dynamic";

type Row = {
  id: string; source: string; signature: string; message: string;
  detail: string | null; created_at: string; resolved_at: string | null;
};

export default async function Errors() {
  const sb = supabaseServer();
  const { data } = await sb.from("error_log")
    .select("id, source, signature, message, detail, created_at, resolved_at")
    .order("created_at", { ascending: false }).limit(300);
  const rows = (data ?? []) as Row[];

  // Group by signature; a group is "burning" if its newest row is unresolved.
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const g = groups.get(r.signature) ?? [];
    g.push(r); groups.set(r.signature, g);
  }
  const burning = [...groups.values()].filter(g => !g[0].resolved_at);
  const resolved = [...groups.values()].filter(g => g[0].resolved_at);

  const card = (g: Row[], live: boolean) => {
    const r = g[0];
    return (
      <div key={r.signature} className="rounded-lg border-2 p-3 mb-2 bg-white" style={{ borderColor: live ? "#D62839" : "#E7DFCE" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-bold" style={{ color: live ? "#D62839" : "#0D9488" }}>
              {live ? "● BURNING" : "✓ RESOLVED"} · {r.source} · ×{g.length} {g.length > 1 ? `(last ${r.created_at.slice(0, 16).replace("T", " ")})` : r.created_at.slice(0, 16).replace("T", " ")}
            </p>
            <p className="text-[13px] font-semibold mt-1" style={{ color: "#181818" }}>{r.message}</p>
            {r.detail && (
              <details className="mt-1">
                <summary className="font-mono text-[10px] cursor-pointer" style={{ color: "#5C574A" }}>STACK DETAIL</summary>
                <pre className="font-mono text-[9px] mt-1 p-2 rounded overflow-x-auto whitespace-pre-wrap" style={{ background: "#F4EFE3", color: "#3E3A30" }}>{r.detail}</pre>
              </details>
            )}
          </div>
          {live && <ResolveError signature={r.signature} />}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="display text-[22px]" style={{ color: "#181818" }}>ERRORS</h1>
      <p className="font-mono text-[10px] mt-1" style={{ color: "#5C574A" }}>
        ALERTS THROTTLE TO 1 EMAIL / SIGNATURE / HOUR · WORKERS SELF-RETRY HOURLY · RESOLVE = SEEN &amp; HANDLED
      </p>
      <div className="mt-4">
        {burning.length ? burning.map(g => card(g, true)) :
          <p className="text-[13px] py-3" style={{ color: "#0D9488" }}>Nothing burning. All quiet.</p>}
      </div>
      {resolved.length > 0 && (
        <details className="mt-4">
          <summary className="font-mono text-[11px] font-bold cursor-pointer" style={{ color: "#3E3A30" }}>RESOLVED ({resolved.length})</summary>
          <div className="mt-2">{resolved.map(g => card(g, false))}</div>
        </details>
      )}
    </div>
  );
}
