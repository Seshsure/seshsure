// ————— CLIENT CLAIMS — status of what they've filed —————
import { supabaseServer } from "@/lib/supabase-server";
import Link from "next/link";
export const dynamic = "force-dynamic";

const STATE: Record<string, [string, string]> = {
  filed: ["FILED — UNDER REVIEW", "#C77800"],
  factory_review: ["WITH PRODUCTION FOR REVIEW", "#C77800"],
  offer_made: ["RESOLUTION OFFERED — CHECK EMAIL", "#0D9488"],
  resolved: ["RESOLVED", "#0D9488"],
  denied: ["CLOSED", "#5C574A"],
};

export default async function ClientDisputes() {
  const sb = supabaseServer();
  const { data: disputes } = await sb.from("disputes")
    .select("id, dispute_number, issue_types, qty_affected_units, status, filed_at, resolution_type, resolution_value_cents")
    .order("filed_at", { ascending: false });

  return (
    <div className="max-w-3xl mx-auto px-4 py-5">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-[16px]" style={{ color: "#181818" }}>Quality claims</h1>
        <Link href="/portal/disputes/new" className="punch-sm px-3 py-2 rounded-lg font-bold text-[12px]" style={{ background: "#181818", color: "#fff" }}>+ File a claim</Link>
      </div>
      {(disputes ?? []).length === 0 ? (
        <div className="rounded-xl border-2 bg-white p-5 mt-4" style={{ borderColor: "#E7DFCE" }}>
          <p className="text-[13px] font-semibold" style={{ color: "#181818" }}>No claims — that&apos;s how we like it</p>
          <p className="text-[12px] mt-1" style={{ color: "#3E3A30" }}>If a delivery has an issue, file within 7 days with photos and lot numbers. Quarantine the affected product; we make it right fast.</p>
        </div>
      ) : (disputes ?? []).map(d => {
        const [label, color] = STATE[d.status] ?? [String(d.status).toUpperCase(), "#3E3A30"];
        return (
          <div key={d.id} className="rounded-xl border-2 bg-white p-4 mt-3" style={{ borderColor: "#E7DFCE" }}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[13px] font-bold" style={{ color: "#181818" }}>{d.dispute_number}</span>
              <span className="font-mono text-[10px] font-bold" style={{ color }}>{label}</span>
            </div>
            <p className="font-mono text-[11px] mt-1" style={{ color: "#3E3A30" }}>
              {(d.issue_types as string[] | null)?.join(", ") ?? "—"} · {d.qty_affected_units?.toLocaleString() ?? "?"} units · filed {String(d.filed_at).slice(0, 10)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
