// ————— ARCADE ADMIN — access decisions, compliance gate at approval —————
import { supabaseServer } from "@/lib/supabase-server";
import { ArcadeAccessCard } from "@/components/ArcadeAccessCard";
import { ArcadeOrderReview } from "@/components/ArcadeOrderReview";
import { AssignConverter, OwnerRunControls } from "@/components/ArcadePrintAdmin";

export const dynamic = "force-dynamic";

export default async function ArcadeAdmin() {
  const sb = supabaseServer();
  const { data: orders } = await sb.from("arcade_orders")
    .select("id, order_number, status, qty_packs, retail_format, custom_words, tiers, hunt_sentence, use_standard_mix, ship_to, needed_by, sale_states, notes, artwork_path, submitted_at, clients(legal_name, dba)")
    .eq("status", "submitted").order("submitted_at", { ascending: true }).limit(20);
  const [{ data: approvedOrders }, { data: converters }, { data: printRuns }] = await Promise.all([
    sb.from("arcade_orders").select("id, order_number").eq("status", "approved").order("reviewed_at", { ascending: true }).limit(20),
    sb.from("converters").select("id, name").eq("is_active", true).order("name"),
    sb.from("arcade_print_runs").select("id, run_number, status, total_peels, proof_note, printed_roll_count, overage_count, destruction_log_path, stop_reason, converters(name), arcade_orders(order_number)")
      .not("status", "in", "(complete)").order("created_at", { ascending: false }).limit(20),
  ]);
  const activeRunOrderIds = new Set((printRuns ?? []).filter(r => r.status !== "stopped").map(r => (r.arcade_orders as unknown as { order_number: string } | null)?.order_number));
  const unassigned = (approvedOrders ?? []).filter(o => !activeRunOrderIds.has(o.order_number));
  const { data: rows } = await sb.from("arcade_access")
    .select("client_id, status, applied_at, application_note, arcade_slug, rules_doc_path, clients(legal_name, dba)")
    .order("applied_at", { ascending: false }).limit(50);
  const pending = (rows ?? []).filter(r => r.status === "applied");
  const rest = (rows ?? []).filter(r => r.status !== "applied");

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="display text-[22px]" style={{ color: "#181818" }}>ARCADE</h1>
      <p className="font-mono text-[10px] mt-1 mb-4" style={{ color: "#5C574A" }}>
        APPROVAL REQUIRES THE COUNSEL-REVIEWED SWEEPSTAKES RULES DOC + A SLUG · SUSPEND STOPS NEW ORDERS/HUNTS, LIVE HUNTS FINISH
      </p>
      {unassigned.length > 0 && (
        <div className="mb-5">
          <p className="font-mono text-[10px] font-bold" style={{ color: "#3E3A30" }}>APPROVED — AWAITING PRINT ASSIGNMENT</p>
          {unassigned.map(o => <AssignConverter key={o.id} orderId={o.id} orderNumber={o.order_number}
            converters={(converters ?? []).map(c => [c.id, c.name] as [string, string])} />)}
        </div>
      )}
      {(printRuns ?? []).length > 0 && (
        <div className="mb-5">
          <p className="font-mono text-[10px] font-bold" style={{ color: "#3E3A30" }}>PRINT RUNS</p>
          {(printRuns ?? []).map(r => {
            const conv = r.converters as unknown as { name: string } | null;
            const ord = r.arcade_orders as unknown as { order_number: string } | null;
            return (
              <div key={r.id} className="rounded-lg border-2 p-3 mt-2 bg-white"
                style={{ borderColor: r.status === "stopped" ? "#D62839" : r.status === "proof_submitted" ? "#B45309" : "#E7DFCE" }}>
                <p className="font-mono text-[11px] font-bold" style={{ color: "#181818" }}>
                  {r.run_number} · {conv?.name} · {ord?.order_number} · {r.total_peels.toLocaleString()} peels · {r.status.replace(/_/g, " ").toUpperCase()}
                </p>
                {r.proof_note && <p className="font-mono text-[9px] mt-0.5" style={{ color: "#5C574A" }}>proof: {r.proof_note}</p>}
                {r.printed_roll_count != null && <p className="font-mono text-[9px] mt-0.5" style={{ color: "#5C574A" }}>
                  rolls declared: {r.printed_roll_count}{r.overage_count != null ? ` · overage ${r.overage_count} · destruction log ${r.destruction_log_path ? "✓" : "—"}` : ""}</p>}
                {r.stop_reason && <p className="font-mono text-[10px] mt-0.5" style={{ color: "#D62839" }}>STOPPED: {r.stop_reason}</p>}
                <OwnerRunControls runId={r.id} status={r.status} />
              </div>
            );
          })}
        </div>
      )}
      {(orders ?? []).length > 0 && (
        <div className="mb-5">
          <p className="font-mono text-[10px] font-bold" style={{ color: "#3E3A30" }}>ORDERS IN REVIEW</p>
          {(orders ?? []).map(o => <ArcadeOrderReview key={o.id} order={o as never} />)}
        </div>
      )}
      {pending.length ? pending.map(r => <ArcadeAccessCard key={r.client_id} row={r as never} />) :
        <p className="text-[13px] py-2" style={{ color: "#5C574A" }}>No pending applications.</p>}
      {rest.length > 0 && (
        <div className="mt-5">
          <p className="font-mono text-[10px] font-bold" style={{ color: "#3E3A30" }}>PROGRAM MEMBERS &amp; HISTORY</p>
          {rest.map(r => <ArcadeAccessCard key={r.client_id} row={r as never} />)}
        </div>
      )}
    </div>
  );
}
