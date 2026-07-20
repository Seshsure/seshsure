// ————— DISPUTE DETAIL: both stories side-by-side, then your ruling —————
import { supabaseServer } from "@/lib/supabase-server";
import { ResolvePanel } from "@/components/ResolvePanel";
import { AiDraftPanel } from "@/components/AiDraftPanel";

export const dynamic = "force-dynamic";

export default async function DisputeDetail({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const { data: d } = await sb.from("disputes")
    .select("*, clients(dba, legal_name), dispute_media(id, path, uploaded_at), dispute_events(actor_side, action, detail, created_at), production_runs(run_number, factories(name))")
    .eq("id", params.id).single();
  if (!d) return <p className="p-8 text-sm text-neutral-400">Dispute not found.</p>;

  const client = d.clients as unknown as { dba: string | null; legal_name: string };
  const run = d.production_runs as unknown as { run_number: string; factories: { name: string } } | null;
  const media = (d.dispute_media ?? []) as { id: string; path: string; uploaded_at: string }[];
  const events = ((d.dispute_events ?? []) as { actor_side: string; action: string; created_at: string }[])
    .sort((a, b) => a.created_at < b.created_at ? -1 : 1);
  const open = !["resolved", "denied"].includes(d.status);

  const Card = ({ title, color, children }: { title: string; color: string; children: React.ReactNode }) => (
    <div className="rounded-lg border overflow-hidden flex-1" style={{ background: "#FFFFFF", borderColor: "#E7DFCE" }}>
      <div className="px-3 py-2 border-b" style={{ borderColor: "#E7DFCE" }}>
        <span className="font-mono text-[11px] font-bold" style={{ color }}>{title}</span>
      </div>
      <div className="px-3 py-3">{children}</div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 pb-8">
      <div className="mt-4 rounded-lg border p-3" style={{ background: "#FFFFFF", borderColor: "#E7DFCE" }}>
        <div className="flex items-center justify-between">
          <p className="font-mono text-[15px] font-bold" style={{ color: "#181818" }}>
            {d.dispute_number}
            {d.urgency === "urgent" && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#E6394622", color: "#E63946" }}>PRODUCTION STOPPED</span>}
            {d.window_status !== "in_window" && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#C7780022", color: "#C77800" }}>OUTSIDE 7D</span>}
          </p>
          <span className="font-mono text-[11px] font-bold" style={{ color: open ? "#C77800" : "#0D9488" }}>{String(d.status).replace(/_/g," ").toUpperCase()}</span>
        </div>
        <p className="font-mono text-[10px] mt-1" style={{ color: "#5C574A" }}>
          {client.dba ?? client.legal_name}{run ? ` · ${run.run_number} @ ${run.factories?.name}` : ""}{d.lot_number ? ` · LOT ${d.lot_number}` : ""}
          {d.days_since_delivery !== null ? ` · FILED DAY ${d.days_since_delivery}` : ""}
        </p>
      </div>

      {/* THE TWO STORIES — side by side, firewalled from each other, visible only to you */}
      <div className="flex gap-2 mt-3">
        <Card title="CLIENT'S STORY" color="#3B5BDB">
          <p className="text-[13px] leading-relaxed" style={{ color: "#181818" }}>{d.description}</p>
          <p className="font-mono text-[10px] mt-2" style={{ color: "#5C574A" }}>
            {(d.issue_types ?? []).join(" · ").toUpperCase()}
            {d.qty_affected_units ? ` · ${Number(d.qty_affected_units).toLocaleString()} UNITS` : ""}
            {d.pct_inspected ? ` · ${d.pct_inspected}% INSPECTED` : ""}
          </p>
          {d.desired_resolution && <p className="font-mono text-[10px] mt-1" style={{ color: "#3E3A30" }}>WANTS: {String(d.desired_resolution).toUpperCase()}</p>}
          <p className="font-mono text-[10px] mt-2" style={{ color: "#5C574A" }}>{media.length} PHOTO{media.length === 1 ? "" : "S"} ATTACHED</p>
        </Card>
        <Card title="FACTORY'S STORY" color="#C77800">
          {d.factory_response
            ? <p className="text-[13px] leading-relaxed" style={{ color: "#181818" }}>{d.factory_response}</p>
            : <p className="text-[12px]" style={{ color: "#5C574A" }}>No response yet — they see the claim in their portal.</p>}
          {d.factory_responded_at && <p className="font-mono text-[10px] mt-2" style={{ color: "#5C574A" }}>RESPONDED {String(d.factory_responded_at).slice(0, 10)}</p>}
        </Card>
      </div>

      {open && <ResolvePanel disputeId={d.id} />}
      <AiDraftPanel tasks={["dispute_client_reply", "dispute_factory_note"]} entityId={d.id} />

      {/* timeline */}
      <div className="mt-3 rounded-lg border overflow-hidden" style={{ background: "#FFFFFF", borderColor: "#E7DFCE" }}>
        <div className="px-3 py-2 border-b" style={{ borderColor: "#E7DFCE" }}>
          <span className="font-mono text-[11px] font-bold" style={{ color: "#3E3A30" }}>TIMELINE</span>
        </div>
        {events.map((e, i) => (
          <div key={i} className="flex px-3 py-2 border-b font-mono text-[11px]" style={{ borderColor: "#E7DFCE" }}>
            <span style={{ color: "#5C574A" }}>{e.created_at.slice(0, 16).replace("T", " ")}</span>
            <span className="ml-3" style={{ color: "#181818" }}>{e.actor_side.toUpperCase()} · {e.action.toUpperCase()}</span>
          </div>
        ))}
      </div>
      {!open && d.root_cause && (
        <p className="font-mono text-[11px] mt-2 px-1" style={{ color: "#3E3A30" }}>
          RULED: {String(d.root_cause).replace(/_/g," ").toUpperCase()} · {String(d.defect_scope ?? "").replace(/_/g," ").toUpperCase()} · {String(d.resolution_type ?? "").toUpperCase()}
        </p>
      )}
    </div>
  );
}
