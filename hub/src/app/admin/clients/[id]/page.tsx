// Client Controls: the per-client switchboard + the demand-letter drafts for this client
import { supabaseServer } from "@/lib/supabase-server";
import { formatUSD } from "@/lib/money";
import { ControlsPanel } from "@/components/ControlsPanel";
import { DemandLetterPanel } from "@/components/DemandLetterPanel";
import { AiDraftPanel } from "@/components/AiDraftPanel";
import { InterestControl } from "@/components/InterestControl";

export const dynamic = "force-dynamic";

export default async function ClientDetail({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const [{ data: client }, { data: invoices }, { data: letters }] = await Promise.all([
    sb.from("clients").select("*").eq("id", params.id).single(),
    sb.from("invoices").select("id, invoice_number, legacy_number, total_cents, paid_cents, due_date, interest_frozen").eq("client_id", params.id).in("status", ["sent","viewed","partially_paid","overdue"]),
    sb.from("demand_letters").select("id, status, total_demanded_cents, draft_text, created_at").eq("client_id", params.id).order("created_at", { ascending: false }).limit(3),
  ]);
  if (!client) return <p className="p-8 text-sm text-neutral-400">Client not found.</p>;
  const exposure = (invoices ?? []).reduce((s, i) => s + BigInt(i.total_cents) - BigInt(i.paid_cents), 0n);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = (invoices ?? []).filter(i => i.due_date && i.due_date < today).length;

  return (
    <div className="max-w-5xl mx-auto px-4 pb-8">
      <div className="mt-4 rounded-lg border p-4" style={{ background: "#FFFFFF", borderColor: "#E7DFCE" }}>
        <p className="text-[14px] font-bold" style={{ color: "#181818" }}>{client.dba ?? client.legal_name}</p>
        <p className="font-mono text-[9px] mt-1" style={{ color: overdue ? "#E63946" : "#6E6A5E" }}>
          EXPOSURE {formatUSD(exposure)}{overdue ? ` · ${overdue} OVERDUE` : ""}{client.hold_active ? " · 🔒 HOLD ACTIVE" : ""}{client.watch_flag ? " · 👁 WATCH" : ""}
        </p>
      </div>
      <div className="flex gap-2 mt-3">
        <a href={`/api/statements/pdf?clientId=${client.id}`} target="_blank" className="flex-1 py-2.5 rounded-lg border text-center font-mono text-[9px] font-bold" style={{ borderColor: "#E7DFCE", color: "#6E6A5E" }}>⬇ STATEMENT PDF</a>
        <a href={`/api/statements/pdf?clientId=${client.id}&forCourt=1`} target="_blank" className="flex-1 py-2.5 rounded-lg border text-center font-mono text-[9px] font-bold" style={{ borderColor: "#C7780044", color: "#C77800" }}>⚖ COURT-RECITAL VERSION</a>
      </div>
      <ControlsPanel clientId={client.id} initial={{
        accepted_methods: client.accepted_methods ?? ["ach"],
        auto_hold: client.auto_hold ?? true,
        hold_active: client.hold_active ?? false,
        absorb_card_fee: client.absorb_card_fee ?? false,
        deposit_pct: client.deposit_pct ?? 50,
        credit_ceiling_cents: client.credit_ceiling_cents ? String(client.credit_ceiling_cents) : null,
        expected_reorder_weeks: client.expected_reorder_weeks ?? 8,
        watch_flag: client.watch_flag ?? false,
      }} />
      <div className="rounded-lg border mt-4 overflow-hidden" style={{ background: "#FFFFFF", borderColor: "#E7DFCE" }}>
        <div className="px-4 py-2 border-b flex justify-between" style={{ borderColor: "#E7DFCE" }}>
          <span className="eyebrow" style={{ color: "#6E6A5E" }}>OPEN INVOICES — INTEREST STARTS ONLY WHEN YOU DECLARE DEFAULT</span>
        </div>
        {(invoices ?? []).filter(i => BigInt(i.total_cents) > BigInt(i.paid_cents)).map(i => (
          <div key={i.id} className="px-4 py-2.5 border-b last:border-0 flex items-center justify-between gap-3" style={{ borderColor: "#E7DFCE" }}>
            <div>
              <span className="font-mono text-[11px] font-bold" style={{ color: "#181818" }}>{i.invoice_number ?? i.legacy_number}</span>
              <span className="font-mono text-[9px] ml-2" style={{ color: i.due_date && i.due_date < new Date().toISOString().slice(0,10) ? "#D62839" : "#9B9484" }}>DUE {i.due_date ?? "—"}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] font-bold" style={{ color: "#181818" }}>
                ${((BigInt(i.total_cents) - BigInt(i.paid_cents)) / 100n).toLocaleString()}
              </span>
              <InterestControl invoiceId={i.id} frozen={i.interest_frozen} />
            </div>
          </div>
        ))}
      </div>

      <AiDraftPanel tasks={["collections_note", "supplier_message"]} entityId={client.id} />
      {(letters?.length ?? 0) > 0 && <DemandLetterPanel letters={(letters ?? []).map(l => ({
        id: l.id, status: l.status, totalCents: String(l.total_demanded_cents), draftText: l.draft_text, createdAt: l.created_at,
      }))} />}
    </div>
  );
}
