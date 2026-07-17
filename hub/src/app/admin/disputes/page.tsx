import { supabaseServer } from "@/lib/supabase-server";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DisputesDesk() {
  const sb = supabaseServer();
  const { data: disputes } = await sb.from("disputes")
    .select("id, dispute_number, status, urgency, window_status, issue_types, days_since_delivery, ack_due_at, filed_at, clients(dba, legal_name)")
    .not("status", "in", '("resolved","denied")').order("filed_at", { ascending: false });

  return (
    <div className="max-w-2xl mx-auto px-4 pb-8">
      <div className="mt-4 rounded-lg border overflow-hidden" style={{ background: "#14181B", borderColor: "#262C31" }}>
        <div className="px-3 py-2 border-b" style={{ borderColor: "#262C31" }}>
          <span className="font-mono text-[10px] font-bold" style={{ color: "#8B949C" }}>RESOLUTION DESK — SLA CLOCKS ARE INTERNAL ONLY</span>
        </div>
        {(disputes ?? []).map(d => {
          const ackLate = d.ack_due_at && new Date(d.ack_due_at) < new Date() && d.status === "submitted";
          return (
            <Link key={d.id} href={`/admin/disputes/${d.id}`} className="block px-3 py-3 border-b" style={{ borderColor: "#262C31" }}>
              <div className="flex items-center justify-between">
                <p className="font-mono text-[11px] font-bold" style={{ color: "#E8EAEC" }}>
                  {d.dispute_number}
                  {d.urgency === "urgent" && <span className="ml-2 text-[8px] px-1.5 py-0.5 rounded" style={{ background: "#E5484D22", color: "#E5484D" }}>PRODUCTION STOPPED</span>}
                  {d.window_status !== "in_window" && <span className="ml-2 text-[8px] px-1.5 py-0.5 rounded" style={{ background: "#F5B84B22", color: "#F5B84B" }}>OUTSIDE 7D — REVIEW</span>}
                </p>
                <span className="font-mono text-[8px] font-bold" style={{ color: ackLate ? "#E5484D" : "#5C666D" }}>
                  {ackLate ? "ACK OVERDUE" : d.status.replace(/_/g, " ").toUpperCase()}
                </span>
              </div>
              <p className="text-[10px] mt-1" style={{ color: "#8B949C" }}>
                {((d.clients as unknown as { dba: string|null })?.dba) ?? (d.clients as unknown as { legal_name: string })?.legal_name}
                {" · "}{(d.issue_types ?? []).join(", ")}
                {d.days_since_delivery !== null ? ` · day ${d.days_since_delivery}` : ""}
              </p>
            </Link>
          );
        })}
        {!disputes?.length && <p className="px-3 py-4 text-[11px]" style={{ color: "#5C666D" }}>No open disputes.</p>}
      </div>
    </div>
  );
}
