// ————— PIPELINE COMMAND: stages, sources, samples, dormancy —————
import { Empty } from "@/components/Empty";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const STAGES = ["lead", "paperwork", "sample", "onboarding", "won", "lost"] as const;
const STAGE_COLOR: Record<string, string> = {
  lead: "#3E3A30", paperwork: "#C77800", sample: "#0D9488", onboarding: "#3B5BDB", won: "#0D9488", lost: "#5C574A",
};

export default async function Pipeline() {
  const sb = supabaseServer();
  const [{ data: prospects }, { data: samples }, { data: dormant }] = await Promise.all([
    sb.from("prospects").select("id, company, contact_name, email, lead_source, stage, show_capture, show_name, created_at").order("created_at", { ascending: false }),
    sb.from("sample_shipments").select("id, shipped_at, followup_3_done, followup_10_done, branded, prospects(company)").not("shipped_at", "is", null).order("shipped_at", { ascending: false }).limit(10),
    sb.from("clients").select("id, dba, legal_name, last_order_at, expected_reorder_weeks").eq("dormant", true),
  ]);

  const byStage = new Map<string, number>();
  const bySource = new Map<string, number>();
  for (const p of prospects ?? []) {
    byStage.set(p.stage, (byStage.get(p.stage) ?? 0) + 1);
    bySource.set(p.lead_source, (bySource.get(p.lead_source) ?? 0) + 1);
  }
  const active = (prospects ?? []).filter(p => !["won", "lost"].includes(p.stage));

  return (
    <div className="max-w-5xl mx-auto px-4 pb-8">
      {/* stage strip */}
      <div className="grid grid-cols-6 gap-1.5 mt-4">
        {STAGES.map(s => (
          <div key={s} className="rounded-lg border p-2 text-center" style={{ background: "#FFFFFF", borderColor: "#E7DFCE" }}>
            <p className="font-mono text-[15px] font-bold" style={{ color: STAGE_COLOR[s] }}>{byStage.get(s) ?? 0}</p>
            <p className="font-mono text-[6px] font-bold mt-0.5" style={{ color: "#5C574A" }}>{s.toUpperCase()}</p>
          </div>
        ))}
      </div>

      {/* lead sources — the REQUIRED field paying off */}
      {bySource.size > 0 && (
        <div className="mt-3 rounded-lg border p-3" style={{ background: "#FFFFFF", borderColor: "#E7DFCE" }}>
          <p className="font-mono text-[10px] font-bold mb-1.5" style={{ color: "#5C574A" }}>WHERE LEADS COME FROM</p>
          <div className="flex flex-wrap gap-1.5">
            {[...bySource.entries()].sort((a, b) => b[1] - a[1]).map(([src, n]) => (
              <span key={src} className="font-mono text-[10px] px-2 py-1 rounded" style={{ background: "#FAF5EA", color: "#3E3A30" }}>
                {src.toUpperCase()} · {n}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* dormant — win-back running */}
      {(dormant?.length ?? 0) > 0 && (
        <div className="mt-3 rounded-lg border overflow-hidden" style={{ background: "#FFFFFF", borderColor: "#C7780044" }}>
          <div className="px-3 py-2 border-b" style={{ borderColor: "#E7DFCE" }}>
            <span className="font-mono text-[12px] font-bold" style={{ color: "#C77800" }}>DORMANT — WIN-BACK RUNNING</span>
          </div>
          {(dormant ?? []).map(c => (
            <div key={c.id} className="px-3 py-2 border-b" style={{ borderColor: "#E7DFCE" }}>
              <span className="text-[13px]" style={{ color: "#181818" }}>{c.dba ?? c.legal_name}</span>
              <span className="font-mono text-[10px] ml-2" style={{ color: "#5C574A" }}>LAST ORDER {c.last_order_at?.slice(0, 10)}</span>
            </div>
          ))}
        </div>
      )}

      {/* active prospects */}
      <div className="mt-3 rounded-lg border overflow-hidden" style={{ background: "#FFFFFF", borderColor: "#E7DFCE" }}>
        <div className="px-3 py-2 border-b" style={{ borderColor: "#E7DFCE" }}>
          <span className="font-mono text-[12px] font-bold" style={{ color: "#3E3A30" }}>ACTIVE PIPELINE</span>
        </div>
        {active.length === 0 && <div className="px-4 py-4"><Empty title="Pipeline is empty" hint="LEADS FROM /START, TRADE-SHOW QR CODES, AND YOUR OWN ENTRIES FILL THIS BOARD" /></div>}
        {active.map(p => (
          <div key={p.id} className="px-3 py-2.5 border-b" style={{ borderColor: "#E7DFCE" }}>
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-semibold" style={{ color: "#181818" }}>
                {p.company}
                {p.show_capture && <span className="ml-2 font-mono text-[9px] px-1.5 py-0.5 rounded" style={{ background: "#3B5BDB22", color: "#3B5BDB" }}>{p.show_name ?? "SHOW"}</span>}
              </p>
              <span className="font-mono text-[10px] font-bold" style={{ color: STAGE_COLOR[p.stage] }}>{p.stage.toUpperCase()}</span>
            </div>
            <p className="font-mono text-[10px] mt-0.5" style={{ color: "#5C574A" }}>
              {p.contact_name ?? ""}{p.email ? ` · ${p.email}` : ""} · VIA {p.lead_source.toUpperCase()}
            </p>
          </div>
        ))}
        {!active.length && <p className="px-3 py-4 text-[13px]" style={{ color: "#5C574A" }}>Pipeline empty — the /start intake link feeds this.</p>}
      </div>

      {/* recent samples */}
      <div className="mt-3 rounded-lg border overflow-hidden" style={{ background: "#FFFFFF", borderColor: "#E7DFCE" }}>
        <div className="px-3 py-2 border-b" style={{ borderColor: "#E7DFCE" }}>
          <span className="font-mono text-[12px] font-bold" style={{ color: "#3E3A30" }}>SAMPLES OUT — DAY 3 + DAY 10 FOLLOW-UPS AUTO-QUEUE</span>
        </div>
        {(samples ?? []).map(s => {
          const days = Math.floor((Date.now() - new Date(s.shipped_at!).getTime()) / 864e5);
          return (
            <div key={s.id} className="flex items-center px-3 py-2 border-b" style={{ borderColor: "#E7DFCE" }}>
              <span className="flex-1 text-[13px]" style={{ color: "#181818" }}>
                {(s.prospects as unknown as { company: string } | null)?.company ?? "client sample"}
                {s.branded && <span className="ml-2 font-mono text-[9px]" style={{ color: "#0D9488" }}>BRANDED — HAND DELIVERY</span>}
              </span>
              <span className="font-mono text-[10px]" style={{ color: "#5C574A" }}>
                DAY {days} · {s.followup_3_done ? "✓3" : "·3"} {s.followup_10_done ? "✓10" : "·10"}
              </span>
            </div>
          );
        })}
        {!samples?.length && <p className="px-3 py-4 text-[13px]" style={{ color: "#5C574A" }}>No samples in flight.</p>}
      </div>
    </div>
  );
}
