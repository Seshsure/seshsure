import { supabaseServer } from "@/lib/supabase-server";
import { FactoryRespond } from "@/components/FactoryRespond";

export const dynamic = "force-dynamic";

export default async function Claims() {
  const sb = supabaseServer();
  const { data: disputes } = await sb.from("disputes")
    .select("id, dispute_number, issue_types, description, qty_affected_units, lot_number, status, factory_responded_at, filed_at")
    .not("status", "in", '("resolved","denied")').order("filed_at", { ascending: false });

  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      <h1 className="font-bold text-[16px] mb-1" style={{ color: "#15181A" }}>Quality claims</h1>
      <p className="text-[10px] font-mono mb-3" style={{ color: "#6E756B" }}>YOUR RESPONSE GOES TO SESHSURE — SESHSURE RULES AND HANDLES THE CUSTOMER</p>
      <div className="rounded-xl border overflow-hidden" style={{ background: "#fff", borderColor: "#E4E1DA" }}>
        {(disputes ?? []).map(d => (
          <div key={d.id} className="px-4 py-3 border-b" style={{ borderColor: "#E4E1DA" }}>
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] font-bold" style={{ color: "#15181A" }}>{d.dispute_number}</p>
              <span className="font-mono text-[8px] font-bold" style={{ color: d.factory_responded_at ? "#0D9488" : "#B4231F" }}>
                {d.factory_responded_at ? "RESPONDED ✓" : "RESPONSE NEEDED"}
              </span>
            </div>
            <p className="text-[10px] mt-1" style={{ color: "#6E756B" }}>
              {(d.issue_types ?? []).join(", ")}{d.lot_number ? ` · LOT ${d.lot_number}` : ""}
              {d.qty_affected_units ? ` · ${Number(d.qty_affected_units).toLocaleString()} UNITS` : ""}
            </p>
            <p className="text-[11px] mt-1.5" style={{ color: "#15181A" }}>{d.description}</p>
            {!d.factory_responded_at && <FactoryRespond disputeId={d.id} />}
          </div>
        ))}
        {!disputes?.length && <p className="px-4 py-6 text-[11px]" style={{ color: "#6E756B" }}>No open claims.</p>}
      </div>
    </div>
  );
}
