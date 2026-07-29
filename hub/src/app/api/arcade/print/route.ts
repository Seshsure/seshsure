// ————— PRINT GATE API — the SOP's sequence as enforced transitions —————
// Converter: declare proofing → submit proof → start printing (only after
// SeshSure approves the proof) → declare printed counts → log overage with
// a signed destruction doc. Owner: assign runs, approve proofs (the
// 100/100 sandbox verification is SeshSure's act), stop on variance.
// Illegal transitions are refused, not warned.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { sendTemplate } from "@/lib/email";

const Body = z.discriminatedUnion("action", [
  // owner
  z.object({ action: z.literal("assign"), orderId: z.string().uuid(), converterId: z.string().uuid() }),
  z.object({ action: z.literal("approve_proof"), runId: z.string().uuid() }),
  z.object({ action: z.literal("stop"), runId: z.string().uuid(), reason: z.string().min(4).max(400) }),
  // converter
  z.object({ action: z.literal("start_proofing"), runId: z.string().uuid() }),
  z.object({ action: z.literal("submit_proof"), runId: z.string().uuid(), note: z.string().min(4).max(400) }),
  z.object({ action: z.literal("start_printing"), runId: z.string().uuid() }),
  z.object({ action: z.literal("declare_printed"), runId: z.string().uuid(), rollCount: z.number().int().positive() }),
  z.object({ action: z.literal("log_overage"), runId: z.string().uuid(), overage: z.number().int().min(0), destructionLogPath: z.string().max(300) }),
]);

const CONVERTER_TRANSITIONS: Record<string, [string, string]> = {
  start_proofing: ["queued", "proofing"],
  submit_proof: ["proofing", "proof_submitted"],
  start_printing: ["proof_approved", "printing"],
  declare_printed: ["printing", "printed"],
  log_overage: ["printed", "overage_logged"],
};

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: me } = await sb.from("profiles").select("role, converter_id").eq("id", user.id).single();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const b = parsed.data;
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // ————— OWNER ACTS —————
  if (b.action === "assign" || b.action === "approve_proof" || b.action === "stop") {
    if (me?.role !== "owner") return NextResponse.json({ error: "owner only" }, { status: 403 });

    if (b.action === "assign") {
      const { data: order } = await svc.from("arcade_orders").select("id, status, qty_packs, order_number").eq("id", b.orderId).single();
      if (!order || order.status !== "approved") return NextResponse.json({ error: "order not approved" }, { status: 400 });
      const { data: existing } = await svc.from("arcade_print_runs").select("id").eq("order_id", b.orderId).not("status", "eq", "stopped").maybeSingle();
      if (existing) return NextResponse.json({ error: "order already has an active print run" }, { status: 400 });
      const runNumber = "PRN-" + Math.random().toString(36).slice(2, 6).toUpperCase();
      const { data: run, error } = await svc.from("arcade_print_runs").insert({
        run_number: runNumber, order_id: b.orderId, converter_id: b.converterId,
        total_peels: order.qty_packs * 800,
      }).select("id").single();
      if (error || !run) return NextResponse.json({ error: "assign failed" }, { status: 500 });
      const { data: conv } = await svc.from("converters").select("name, contact_email").eq("id", b.converterId).single();
      if (conv?.contact_email) await sendTemplate({
        to: conv.contact_email, templateKey: "arcade.print_assigned",
        vars: { run: runNumber, peels: (order.qty_packs * 800).toLocaleString(), order: order.order_number },
        systemOverride: true, bccOwner: true,
      }).catch(() => {});
      await svc.from("activity_log").insert({
        actor_profile_id: user.id, actor_label: "owner", action: "arcade.print.assigned",
        entity_table: "arcade_print_runs", entity_id: run.id, after: { run_number: runNumber, converter: conv?.name },
      });
      return NextResponse.json({ ok: true, runNumber });
    }

    const { data: run } = await svc.from("arcade_print_runs").select("id, status, run_number").eq("id", b.runId).single();
    if (!run) return NextResponse.json({ error: "no run" }, { status: 404 });

    if (b.action === "approve_proof") {
      if (run.status !== "proof_submitted") return NextResponse.json({ error: "proof not submitted" }, { status: 400 });
      await svc.from("arcade_print_runs").update({
        status: "proof_approved", proof_approved_at: new Date().toISOString(), proof_approved_by: user.id,
      }).eq("id", b.runId);
    } else {
      await svc.from("arcade_print_runs").update({ status: "stopped", stop_reason: b.reason }).eq("id", b.runId);
    }
    await svc.from("activity_log").insert({
      actor_profile_id: user.id, actor_label: "owner",
      action: b.action === "approve_proof" ? "arcade.print.proof_approved" : "arcade.print.stopped",
      entity_table: "arcade_print_runs", entity_id: b.runId,
      after: b.action === "stop" ? { reason: b.reason } : { run_number: run.run_number },
    });
    return NextResponse.json({ ok: true });
  }

  // ————— CONVERTER ACTS — legal transitions only, own runs only (RLS) —————
  if (me?.role !== "converter_admin" || !me.converter_id)
    return NextResponse.json({ error: "converter only" }, { status: 403 });
  const [fromStatus, toStatus] = CONVERTER_TRANSITIONS[b.action];
  const { data: run } = await sb.from("arcade_print_runs")
    .select("id, status, run_number, total_peels").eq("id", b.runId).single(); // RLS-scoped read
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (run.status !== fromStatus)
    return NextResponse.json({ error: `illegal transition: run is ${run.status}, this action needs ${fromStatus}` }, { status: 400 });

  const patch: Record<string, unknown> = { status: toStatus };
  if (b.action === "submit_proof") { patch.proof_submitted_at = new Date().toISOString(); patch.proof_note = b.note; }
  if (b.action === "declare_printed") { patch.printed_at = new Date().toISOString(); patch.printed_roll_count = b.rollCount; }
  if (b.action === "log_overage") {
    patch.overage_count = b.overage; patch.destruction_log_path = b.destructionLogPath;
    patch.overage_logged_at = new Date().toISOString();
  }
  const { error } = await sb.from("arcade_print_runs").update(patch).eq("id", b.runId);
  if (error) return NextResponse.json({ error: "not permitted" }, { status: 403 });

  // Owner alert on the two decision moments: proof waiting, overage logged.
  if (b.action === "submit_proof" || b.action === "log_overage") {
    await sendTemplate({
      to: "rob@seshsure.com", templateKey: "arcade.print_update",
      vars: { run: run.run_number ?? "PRN-?", event: b.action === "submit_proof" ? "PROOF SUBMITTED — sandbox-verify 100/100 then approve" : `OVERAGE LOGGED (${(b as { overage: number }).overage}) — destruction log attached, reconcile at gate` },
      systemOverride: true, bccOwner: false,
    }).catch(() => {});
  }
  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: "converter", action: `arcade.print.${b.action}`,
    entity_table: "arcade_print_runs", entity_id: b.runId, after: patch,
  });
  return NextResponse.json({ ok: true });
}
