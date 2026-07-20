// ————— FACTORY STATEMENT — their ledger with SeshSure —————
import { supabaseServer } from "@/lib/supabase-server";
import { FactoryInvoiceSubmit } from "@/components/FactoryInvoiceSubmit";
export const dynamic = "force-dynamic";

export default async function FactoryStatement() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { resolveFactory } = await import("@/lib/factory-context");
  const { factoryId } = await resolveFactory(sb, user!.id);
  if (!factoryId) return null;

  const [{ data: invoices }, { data: runs }] = await Promise.all([
    sb.from("factory_invoices").select("id, invoice_ref, amount_cents, due_date, three_way_matched, approved_at, paid_at, paid_amount_cents, submitted_at, production_runs(run_number)").eq("factory_id", factoryId).order("submitted_at", { ascending: false }),
    sb.from("production_runs").select("id, run_number").eq("factory_id", factoryId).not("status", "in", '("closed")').order("created_at", { ascending: false }),
  ]);

  const billed = (invoices ?? []).reduce((s, i) => s + BigInt(i.amount_cents), 0n);
  const paid = (invoices ?? []).reduce((s, i) => s + BigInt(i.paid_amount_cents ?? 0), 0n);
  const usd = (c: bigint | number) => "$" + Number(BigInt(c) / 100n).toLocaleString();

  return (
    <div className="max-w-3xl mx-auto px-4 py-5">
      <h1 className="font-bold text-[16px]" style={{ color: "#181818" }}>Statement</h1>
      <div className="flex gap-6 mt-2 font-mono text-[13px]">
        <span style={{ color: "#3E3A30" }}>BILLED <b style={{ color: "#181818" }}>{usd(billed)}</b></span>
        <span style={{ color: "#3E3A30" }}>PAID <b style={{ color: "#0D9488" }}>{usd(paid)}</b></span>
        <span style={{ color: "#3E3A30" }}>BALANCE <b style={{ color: "#181818" }}>{usd(billed - paid)}</b></span>
      </div>

      <FactoryInvoiceSubmit factoryId={factoryId} runs={(runs ?? []).map(r => ({ id: r.id, label: r.run_number }))} />

      <div className="rounded-xl border-2 bg-white mt-4 overflow-hidden" style={{ borderColor: "#181818" }}>
        <div className="px-4 py-2 border-b" style={{ borderColor: "#E7DFCE" }}>
          <span className="eyebrow" style={{ color: "#3E3A30" }}>YOUR INVOICES</span>
        </div>
        {(invoices ?? []).length === 0 && <p className="px-4 py-4 text-[13px]" style={{ color: "#3E3A30" }}>No invoices yet — submit one against a run above.</p>}
        {(invoices ?? []).map(i => {
          const run = (i.production_runs as unknown as { run_number: string } | null)?.run_number;
          const state = i.paid_at ? ["PAID", "#0D9488"] : i.approved_at ? ["APPROVED — IN PAYMENT QUEUE", "#0D9488"] : i.three_way_matched === false ? ["MISMATCH — UNDER REVIEW", "#D62839"] : ["SUBMITTED — MATCHING", "#C77800"];
          return (
            <div key={i.id} className="px-4 py-2.5 border-b last:border-0 flex items-center justify-between" style={{ borderColor: "#E7DFCE" }}>
              <div>
                <span className="font-mono text-[13px] font-bold" style={{ color: "#181818" }}>{i.invoice_ref ?? "—"}</span>
                {run && <span className="font-mono text-[10px] ml-2" style={{ color: "#5C574A" }}>RUN {run}</span>}
                <span className="block font-mono text-[9px] mt-0.5" style={{ color: state[1] }}>{state[0]}</span>
              </div>
              <span className="font-mono text-[13px] font-bold" style={{ color: "#181818" }}>{usd(i.amount_cents)}</span>
            </div>
          );
        })}
      </div>
      <p className="font-mono text-[10px] mt-3 leading-relaxed" style={{ color: "#5C574A" }}>
        INVOICES ARE MATCHED AGAINST THE PO AND RECEIVED GOODS (THREE-WAY MATCH). MATCHED = AUTO-APPROVED FOR PAYMENT. QUESTIONS COME FROM SESHSURE DIRECTLY.
      </p>
    </div>
  );
}
