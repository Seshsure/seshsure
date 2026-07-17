import { supabaseServer } from "@/lib/supabase-server";
import { formatUSD } from "@/lib/money";
import { ReleaseButton } from "@/components/ReleaseButton";

export const dynamic = "force-dynamic";

export default async function Batches() {
  const sb = supabaseServer();
  const today = new Date().toISOString().slice(0, 10);
  const { data: ready } = await sb.from("payments")
    .select("id, amount_cents, clients(dba, legal_name)")
    .in("status", ["authorized", "scheduled"])
    .or(`scheduled_for.is.null,scheduled_for.lte.${today}`);
  const total = (ready ?? []).reduce((s, p) => s + BigInt(p.amount_cents), 0n);

  return (
    <div className="max-w-2xl mx-auto px-4 pb-8">
      <div className="mt-4 rounded-lg border overflow-hidden" style={{ background: "#14181B", borderColor: "#262C31" }}>
        <div className="px-3 py-2.5 border-b flex justify-between" style={{ borderColor: "#262C31" }}>
          <span className="font-mono text-[10px] font-bold" style={{ color: "#8B949C" }}>TODAY&apos;S BATCH</span>
          <span className="font-mono text-[10px] font-bold" style={{ color: "#2DD4BF" }}>{ready?.length ?? 0} DEBITS</span>
        </div>
        {(ready ?? []).map(p => (
          <div key={p.id} className="flex px-3 py-2.5 border-b" style={{ borderColor: "#262C31" }}>
            <span className="flex-1 text-[12px]" style={{ color: "#E8EAEC" }}>
              {((p.clients as unknown as { dba: string|null })?.dba) ?? (p.clients as unknown as { legal_name: string })?.legal_name}
            </span>
            <span className="font-mono text-[12px] font-bold" style={{ color: "#E8EAEC" }}>{formatUSD(BigInt(p.amount_cents))}</span>
          </div>
        ))}
        <div className="flex justify-between px-3 py-3" style={{ background: "#0C0F11" }}>
          <span className="text-[12px] font-bold" style={{ color: "#E8EAEC" }}>Total to release</span>
          <span className="font-mono text-[15px] font-bold" style={{ color: "#2DD4BF" }}>{formatUSD(total)}</span>
        </div>
      </div>
      {total > 0n && <ReleaseButton expectedTotalCents={total.toString()} />}
      <p className="font-mono text-[8px] mt-3 px-1" style={{ color: "#5C666D" }}>
        RELEASING BUILDS THE NACHA FILE AND MARKS PAYMENTS SUBMITTED · OWNER-ONLY · TWO-TAP CONFIRM
      </p>
    </div>
  );
}
