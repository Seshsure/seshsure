// ————— DISPUTE RESOLUTION (owner) — root cause REQUIRED, blast radius lot-wide only —————
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({
  disputeId: z.string().uuid(),
  rootCause: z.enum(["factory_fault","freight_damage","client_side","no_fault_found","goodwill"]),
  defectScope: z.enum(["order_specific","lot_wide"]),
  resolutionType: z.enum(["replacement","credit","refund","denied","partial_credit"]),
  resolutionValueCents: z.string().regex(/^\d+$/).optional(),
  noteToClient: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (prof?.role !== "owner") return NextResponse.json({ error: "owner only — resolutions are yours" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;

  const { data: d } = await sb.from("disputes")
    .select("id, dispute_number, client_id, invoice_id, run_id, lot_number, status").eq("id", b.disputeId).single();
  if (!d) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (["resolved","denied"].includes(d.status)) return NextResponse.json({ error: "already closed" }, { status: 400 });

  const value = b.resolutionValueCents ? BigInt(b.resolutionValueCents) : 0n;

  await sb.from("disputes").update({
    status: b.resolutionType === "denied" ? "denied" : "resolved",
    root_cause: b.rootCause, defect_scope: b.defectScope,
    resolution_type: b.resolutionType,
    resolution_value_cents: value.toString(),
    resolved_at: new Date().toISOString(),
  }).eq("id", d.id);

  // credit memo on credit/refund resolutions
  if (["credit","partial_credit","refund"].includes(b.resolutionType) && value > 0n) {
    await sb.from("account_credits").insert({
      client_id: d.client_id, amount_cents: value.toString(),
      reason: `Dispute ${d.dispute_number} — ${b.rootCause.replace(/_/g," ")}`,
      created_by: user.id,
    });
  }
  // replacement on factory fault: $0 run, factory pays materials + freight (locked)
  if (b.resolutionType === "replacement" && b.rootCause === "factory_fault" && d.run_id) {
    const { data: origRun } = await sb.from("production_runs").select("factory_id").eq("id", d.run_id).single();
    if (origRun) {
      await sb.from("production_runs").insert({
        run_number: `R-RPL-${d.dispute_number.replace("SS-D-","")}`,
        factory_id: origRun.factory_id, status: "placed",
        is_replacement: true, replaces_run_id: d.run_id, zero_cost: true,
      });
    }
  }
  // BLAST RADIUS: lot-wide defects only (Rob's ruling) — order-specific stays private
  if (b.defectScope === "lot_wide" && d.lot_number && b.rootCause === "factory_fault") {
    const { data: sameLot } = await sb.from("disputes")
      .select("client_id").eq("lot_number", d.lot_number).neq("id", d.id);
    const affected = new Set((sameLot ?? []).map(x => x.client_id));
    await sb.from("tasks").insert({
      title: `💥 BLAST RADIUS: lot ${d.lot_number} ruled defective — ${affected.size} other client(s) touched this lot. Proactive outreach?`,
      kind: "blast_radius", related_id: d.id, auto_generated: true,
      due_on: new Date().toISOString().slice(0, 10),
    });
  }
  // unpause collections on the invoice
  if (d.invoice_id) await sb.from("invoices").update({ dispute_paused: false }).eq("id", d.invoice_id);

  await sb.from("dispute_events").insert({
    dispute_id: d.id, actor_side: "owner", actor_profile_id: user.id,
    action: "resolved", detail: { root_cause: b.rootCause, scope: b.defectScope, type: b.resolutionType, value_cents: value.toString(), note: b.noteToClient ?? null },
  });
  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: prof.full_name,
    action: "dispute.resolved", entity_table: "disputes", entity_id: d.id, client_id: d.client_id,
    after: { number: d.dispute_number, root_cause: b.rootCause, scope: b.defectScope },
  });
  return NextResponse.json({ ok: true });
}
