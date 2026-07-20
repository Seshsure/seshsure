import { Empty } from "@/components/Empty";
import { supabaseServer } from "@/lib/supabase-server";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DisputesDesk() {
  const sb = supabaseServer();
  const { data: disputes } = await sb.from("disputes")
    .select("id, dispute_number, status, urgency, window_status, issue_types, days_since_delivery, ack_due_at, filed_at, clients(dba, legal_name)")
    .not("status", "in", '("resolved","denied")').order("filed_at", { ascending: false });

  return (
    <div className="max-w-5xl mx-auto px-4 pb-8">
      <div className="mt-4 rounded-lg border overflow-hidden" style={{ background: "#FFFFFF", borderColor: "#E7DFCE" }}>
        <div className="px-3 py-2 border-b" style={{ borderColor: "#E7DFCE" }}>
          <span className="font-mono text-[10px] font-bold" style={{ color: "#6E6A5E" }}>RESOLUTION DESK — SLA CLOCKS ARE INTERNAL ONLY</span>
        </div>
        {(disputes ?? []).length === 0 && <div className="px-4 py-4"><Empty title="No open disputes" hint="WHEN A CLIENT FILES A CLAIM IT APPEARS HERE WITH ITS SLA CLOCK RUNNING" /></div>}
        {(disputes ?? []).map(d => {
          const ackLate = d.ack_due_at && new Date(d.ack_due_at) < new Date() && d.status === "submitted";
          return (
            <Link key={d.id} href={`/admin/disputes/${d.id}`} className="block px-3 py-3 border-b" style={{ borderColor: "#E7DFCE" }}>
              <div className="flex items-center justify-between">
                <p className="font-mono text-[11px] font-bold" style={{ color: "#181818" }}>
                  {d.dispute_number}
                  {d.urgency === "urgent" && <span className="ml-2 text-[8px] px-1.5 py-0.5 rounded" style={{ background: "#E6394622", color: "#E63946" }}>PRODUCTION STOPPED</span>}
                  {d.window_status !== "in_window" && <span className="ml-2 text-[8px] px-1.5 py-0.5 rounded" style={{ background: "#C7780022", color: "#C77800" }}>OUTSIDE 7D — REVIEW</span>}
                </p>
                <span className="font-mono text-[8px] font-bold" style={{ color: ackLate ? "#E63946" : "#9B9484" }}>
                  {ackLate ? "ACK OVERDUE" : d.status.replace(/_/g, " ").toUpperCase()}
                </span>
              </div>
              <p className="text-[10px] mt-1" style={{ color: "#6E6A5E" }}>
                {((d.clients as unknown as { dba: string|null })?.dba) ?? (d.clients as unknown as { legal_name: string })?.legal_name}
                {" · "}{(d.issue_types ?? []).join(", ")}
                {d.days_since_delivery !== null ? ` · day ${d.days_since_delivery}` : ""}
              </p>
            </Link>
          );
        })}
        {!disputes?.length && <p className="px-3 py-4 text-[11px]" style={{ color: "#9B9484" }}>No open disputes.</p>}
      </div>
    </div>
  );
}
