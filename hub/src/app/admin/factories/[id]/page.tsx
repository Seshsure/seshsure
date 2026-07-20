// Factory detail: onboarding progress + qualification flips
import { supabaseServer } from "@/lib/supabase-server";
import { FactoryControls } from "@/components/FactoryControls";

export const dynamic = "force-dynamic";

export default async function FactoryDetail({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const [{ data: f }, { data: sigs }, { data: rates }, { data: acks }, { count: closedRuns }] = await Promise.all([
    sb.from("factories").select("*").eq("id", params.id).single(),
    sb.from("signatures").select("id, signer_name_typed, created_at, agreement_versions(doc_key)").eq("factory_id", params.id),
    sb.from("factory_rate_card").select("id").eq("factory_id", params.id).limit(1),
    sb.from("spec_acknowledgments").select("id").eq("factory_id", params.id).limit(1),
    sb.from("production_runs").select("id", { count: "exact", head: true }).eq("factory_id", params.id).eq("status", "closed"),
  ]);
  if (!f) return <p className="p-8 text-sm text-neutral-400">Factory not found.</p>;

  const steps: [string, boolean, string][] = [
    ["TERMS SIGNED (NDA + NON-CIRCUMVENTION)", (sigs?.length ?? 0) > 0, sigs?.[0] ? `BY ${sigs[0].signer_name_typed}` : "AWAITING SIGNATURE"],
    ["PAYMENT TERMS SET", !!f.payment_terms, f.payment_terms ? `${String(f.payment_terms).toUpperCase()} · USD${f.early_pay_discount_bps ? ` · ${f.early_pay_discount_bps}BPS EARLY-PAY` : ""}` : "OWNER STEP"],
    ["RATE CARD ON FILE", (rates?.length ?? 0) > 0, (rates?.length ?? 0) > 0 ? "FEEDS MARGIN FLOOR" : "REQUIRED BEFORE FLAGSHIP APPROVAL MATH"],
    ["SPEC ACKNOWLEDGED", (acks?.length ?? 0) > 0, (acks?.length ?? 0) > 0 ? "CURRENT VERSION" : "FACTORY STEP"],
    ["QUALIFICATION RUN COMPLETE", (closedRuns ?? 0) > 0, `${closedRuns ?? 0} CLOSED RUN${closedRuns === 1 ? "" : "S"}`],
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 pb-8">
      <div className="mt-4 rounded-lg border p-3" style={{ background: "#FFFFFF", borderColor: "#E7DFCE" }}>
        <p className="text-[14px] font-bold" style={{ color: "#181818" }}>{f.name}</p>
        <p className="font-mono text-[8px] mt-0.5" style={{ color: "#9B9484" }}>{f.country ?? "COUNTRY TBD"} · {f.currency}</p>
      </div>
      <div className="mt-3 rounded-lg border overflow-hidden" style={{ background: "#FFFFFF", borderColor: "#E7DFCE" }}>
        <div className="px-3 py-2 border-b" style={{ borderColor: "#E7DFCE" }}>
          <span className="font-mono text-[9px] font-bold" style={{ color: "#6E6A5E" }}>ONBOARDING</span>
        </div>
        {steps.map(([label, done, sub]) => (
          <div key={label} className="flex items-center px-3 py-2.5 border-b" style={{ borderColor: "#E7DFCE" }}>
            <span className="w-4 h-4 rounded-full mr-3 flex items-center justify-center text-[8px] font-bold"
              style={{ background: done ? "#0D9488" : "#E7DFCE", color: done ? "#FAF5EA" : "#9B9484" }}>{done ? "✓" : "·"}</span>
            <div className="flex-1">
              <p className="font-mono text-[9px] font-bold" style={{ color: done ? "#181818" : "#6E6A5E" }}>{label}</p>
              <p className="font-mono text-[7px] mt-0.5" style={{ color: "#9B9484" }}>{sub}</p>
            </div>
          </div>
        ))}
      </div>
      <FactoryControls factoryId={f.id} initial={{
        board_eligible: f.board_eligible, flagship_approved: f.flagship_approved, is_active: f.is_active,
      }} qualified={(closedRuns ?? 0) > 0} />
    </div>
  );
}
