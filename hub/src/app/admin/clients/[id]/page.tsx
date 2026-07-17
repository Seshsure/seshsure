// Client Controls: the per-client switchboard + the demand-letter drafts for this client
import { supabaseServer } from "@/lib/supabase-server";
import { formatUSD } from "@/lib/money";
import { ControlsPanel } from "@/components/ControlsPanel";
import { DemandLetterPanel } from "@/components/DemandLetterPanel";

export const dynamic = "force-dynamic";

export default async function ClientDetail({ params }: { params: { id: string } }) {
  const sb = supabaseServer();
  const [{ data: client }, { data: invoices }, { data: letters }] = await Promise.all([
    sb.from("clients").select("*").eq("id", params.id).single(),
    sb.from("invoices").select("total_cents, paid_cents, due_date").eq("client_id", params.id).in("status", ["sent","viewed","partially_paid","overdue"]),
    sb.from("demand_letters").select("id, status, total_demanded_cents, draft_text, created_at").eq("client_id", params.id).order("created_at", { ascending: false }).limit(3),
  ]);
  if (!client) return <p className="p-8 text-sm text-neutral-400">Client not found.</p>;
  const exposure = (invoices ?? []).reduce((s, i) => s + BigInt(i.total_cents) - BigInt(i.paid_cents), 0n);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = (invoices ?? []).filter(i => i.due_date && i.due_date < today).length;

  return (
    <div className="max-w-2xl mx-auto px-4 pb-8">
      <div className="mt-4 rounded-lg border p-4" style={{ background: "#14181B", borderColor: "#262C31" }}>
        <p className="text-[14px] font-bold" style={{ color: "#E8EAEC" }}>{client.dba ?? client.legal_name}</p>
        <p className="font-mono text-[9px] mt-1" style={{ color: overdue ? "#E5484D" : "#8B949C" }}>
          EXPOSURE {formatUSD(exposure)}{overdue ? ` · ${overdue} OVERDUE` : ""}{client.hold_active ? " · 🔒 HOLD ACTIVE" : ""}{client.watch_flag ? " · 👁 WATCH" : ""}
        </p>
      </div>
      <div className="flex gap-2 mt-3">
        <a href={`/api/statements/pdf?clientId=${client.id}`} target="_blank" className="flex-1 py-2.5 rounded-lg border text-center font-mono text-[9px] font-bold" style={{ borderColor: "#262C31", color: "#8B949C" }}>⬇ STATEMENT PDF</a>
        <a href={`/api/statements/pdf?clientId=${client.id}&forCourt=1`} target="_blank" className="flex-1 py-2.5 rounded-lg border text-center font-mono text-[9px] font-bold" style={{ borderColor: "#F5B84B44", color: "#F5B84B" }}>⚖ COURT-RECITAL VERSION</a>
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
      {(letters?.length ?? 0) > 0 && <DemandLetterPanel letters={(letters ?? []).map(l => ({
        id: l.id, status: l.status, totalCents: String(l.total_demanded_cents), draftText: l.draft_text, createdAt: l.created_at,
      }))} />}
    </div>
  );
}
