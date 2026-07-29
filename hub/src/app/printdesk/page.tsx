// ————— PRINT DESK — the converter's single pane —————
// Upcoming and active runs, RLS-scoped. Actions appear only when the gate
// sequence allows them; a stopped run shows the stop reason and nothing else.
import { supabaseServer } from "@/lib/supabase-server";
import { PrintRunActions } from "@/components/PrintRunActions";
import { PrintManifest } from "@/components/PrintManifest";

export const dynamic = "force-dynamic";

const TONE: Record<string, string> = {
  queued: "#6C4AB0", proofing: "#6C4AB0", proof_submitted: "#B45309",
  proof_approved: "#0D9488", printing: "#0D9488", printed: "#B45309",
  overage_logged: "#0D9488", complete: "#5C574A", stopped: "#D62839",
};

export default async function PrintDesk() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: prof } = await sb.from("profiles").select("converter_id").eq("id", user!.id).single();
  const { data: conv } = prof?.converter_id
    ? await sb.from("converters").select("name").eq("id", prof.converter_id).single() : { data: null };
  const { data: runs } = await sb.from("arcade_print_runs")
    .select("id, run_number, status, total_peels, proof_note, printed_roll_count, overage_count, stop_reason, created_at, arcade_orders(order_number, retail_format, artwork_path, needed_by)")
    .not("status", "in", "(complete)").order("created_at", { ascending: false }).limit(30);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="display text-[22px]" style={{ color: "#181818" }}>PRINT DESK</h1>
      <p className="font-mono text-[10px] mt-1" style={{ color: "#5C574A" }}>
        {conv?.name?.toUpperCase() ?? "PRINT PARTNER"} · SESHSURE STOCK ONLY · ROLLS SHIP TO SESHSURE ONLY · VARIANCE = FULL STOP
      </p>
      <div className="mt-4">
        {(runs ?? []).map(r => {
          const o = r.arcade_orders as unknown as { order_number: string; retail_format: string; artwork_path: string | null; needed_by: string | null } | null;
          return (
            <div key={r.id} className="rounded-lg border-2 p-3 mb-3 bg-white"
              style={{ borderColor: r.status === "stopped" ? "#D62839" : "#E7DFCE" }}>
              <div className="flex items-center justify-between">
                <p className="font-mono text-[12px] font-bold" style={{ color: "#181818" }}>
                  {r.run_number} · {r.total_peels.toLocaleString()} peels · {o?.retail_format}-cone
                </p>
                <span className="font-mono text-[9px] font-bold px-2 py-0.5 rounded"
                  style={{ background: (TONE[r.status] ?? "#5C574A") + "15", color: TONE[r.status] ?? "#5C574A" }}>
                  {r.status.replace(/_/g, " ").toUpperCase()}
                </span>
              </div>
              <p className="font-mono text-[10px] mt-1" style={{ color: "#5C574A" }}>
                order {o?.order_number}{o?.needed_by ? ` · needed ${o.needed_by}` : ""} · artwork {o?.artwork_path ? "attached (via SeshSure)" : "pending"}
              </p>
              <PrintManifest runId={r.id} />
              {r.status === "stopped" ? (
                <p className="text-[12px] mt-1.5 p-2 rounded" style={{ background: "#D6283910", color: "#D62839" }}>
                  <b>RUN STOPPED:</b> {r.stop_reason} — await SeshSure before any further action.
                </p>
              ) : (
                <PrintRunActions runId={r.id} status={r.status} />
              )}
            </div>
          );
        })}
        {!runs?.length && <p className="text-[13px] py-4" style={{ color: "#5C574A" }}>No runs assigned.</p>}
      </div>
    </div>
  );
}
