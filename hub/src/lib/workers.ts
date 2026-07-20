// ————— THE WORKERS: jobs the machine runs on itself —————
import { SupabaseClient } from "@supabase/supabase-js";
import { pctOf } from "./money";

const log = async (sb: SupabaseClient, action: string, detail: Record<string, unknown>) =>
  sb.from("activity_log").insert({ actor_label: "system", action, after: detail });

function addBusinessDays(d: Date, n: number) {
  const x = new Date(d);
  while (n > 0) { x.setDate(x.getDate() + 1); if (x.getDay() !== 0 && x.getDay() !== 6) n--; }
  return x;
}

/** 1 — Settlement clock */
export async function settleAndClear(sb: SupabaseClient) {
  const now = new Date();
  const { data: submitted } = await sb.from("payments")
    .select("id, created_at").eq("status", "submitted").eq("method", "ach");
  for (const p of submitted ?? []) {
    if (addBusinessDays(new Date(p.created_at), 1) <= now) {
      await sb.from("payments").update({ status: "settled", settled_at: now.toISOString() }).eq("id", p.id);
    }
  }
  const { data: settled } = await sb.from("payments")
    .select("id, settled_at").eq("status", "settled");
  let cleared = 0;
  for (const p of settled ?? []) {
    if (p.settled_at && addBusinessDays(new Date(p.settled_at), 2) <= now) {
      await sb.from("payments").update({ status: "cleared", cleared_at: now.toISOString() }).eq("id", p.id);
      cleared++;
    }
  }
  if (cleared) await log(sb, "worker.payments_cleared", { cleared });
}

/** 2 — Apply cleared money to invoices */
export async function applyClearedToInvoices(sb: SupabaseClient) {
  const { data: allocs } = await sb.from("payment_allocations")
    .select("invoice_id, amount_cents, payments!inner(status)")
    .eq("payments.status", "cleared");
  const byInvoice = new Map<string, bigint>();
  for (const a of allocs ?? []) {
    byInvoice.set(a.invoice_id, (byInvoice.get(a.invoice_id) ?? 0n) + BigInt(a.amount_cents));
  }
  for (const [invoiceId, clearedPaid] of byInvoice) {
    const { data: inv } = await sb.from("invoices")
      .select("id, total_cents, paid_cents, status").eq("id", invoiceId).single();
    if (!inv || inv.status === "void") continue;
    const newStatus = clearedPaid >= BigInt(inv.total_cents) ? "paid"
      : clearedPaid > 0n ? "partially_paid" : inv.status;
    if (BigInt(inv.paid_cents) !== clearedPaid || inv.status !== newStatus) {
      await sb.from("invoices").update({ paid_cents: clearedPaid.toString(), status: newStatus }).eq("id", invoiceId);
    }
  }
}

/** 3 — Run placement: honors routed_factory_id */
export async function placeRuns(sb: SupabaseClient) {
  const { data: factories } = await sb.from("factories").select("id").eq("is_active", true).limit(1);
  const defaultFactoryId = factories?.[0]?.id;
  if (!defaultFactoryId) return;

  const { data: orders } = await sb.from("orders")
    .select("id, order_number, deposit_pct, early_start_override, status, routed_factory_id")
    .eq("status", "approved");
  for (const o of orders ?? []) {
    const zeroDeposit = (o.deposit_pct ?? 50) === 0;
    let go = zeroDeposit || o.early_start_override;
    if (!go) {
      const { data: dep } = await sb.from("invoices")
        .select("status").eq("order_id", o.id).eq("kind", "deposit").maybeSingle();
      go = dep?.status === "paid";
    }
    if (!go) continue;

    const { data: existing } = await sb.from("run_orders").select("run_id").eq("order_id", o.id).maybeSingle();
    if (existing) { await sb.from("orders").update({ status: "in_production" }).eq("id", o.id); continue; }

    const runNumber = `R-${1000 + Math.floor(Date.now() / 1000) % 90000}`;
    const { data: run } = await sb.from("production_runs")
      .insert({ run_number: runNumber, factory_id: o.routed_factory_id ?? defaultFactoryId, status: "placed" })
      .select("id").single();
    if (run) {
      await sb.from("run_orders").insert({ run_id: run.id, order_id: o.id });
      await sb.from("orders").update({ status: "in_production" }).eq("id", o.id);
      await log(sb, "worker.run_placed", { order: o.order_number, run: runNumber });
    }
  }
}

/** 4 — Deposit expiry */
export async function expireStaleDeposits(sb: SupabaseClient) {
  const now = new Date().toISOString();
  const { data: stale } = await sb.from("orders")
    .select("id, order_number, expires_at").eq("status", "approved").lt("expires_at", now);
  for (const o of stale ?? []) {
    const { data: dep } = await sb.from("invoices")
      .select("id, status").eq("order_id", o.id).eq("kind", "deposit").maybeSingle();
    if (dep && dep.status !== "paid") {
      await sb.from("orders").update({ status: "expired" }).eq("id", o.id);
      await sb.from("invoices").update({ status: "void", void_reason: "order expired — deposit unpaid 14 days" }).eq("id", dep.id);
      await log(sb, "worker.order_expired", { order: o.order_number });
    }
  }
}

/** 5 — Reminder ladder */
const LADDER: [string, number][] = [["due", 0], ["plus3", 3], ["plus7", 7], ["plus14", 14], ["final21", 21]];
export async function reminderLadder(sb: SupabaseClient) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: open } = await sb.from("invoices")
    .select("id, invoice_number, client_id, due_date, status, dispute_paused, promise_to_pay_date")
    .in("status", ["sent", "viewed", "partially_paid", "overdue"]).eq("dunning_paused", false).not("due_date", "is", null);

  for (const inv of open ?? []) {
    if (inv.dispute_paused) continue;
    if (inv.promise_to_pay_date && inv.promise_to_pay_date >= today) continue;
    if (inv.due_date! < today && inv.status !== "overdue") {
      await sb.from("invoices").update({ status: "overdue" }).eq("id", inv.id);
    }
    for (const [step, offset] of LADDER) {
      const when = new Date(inv.due_date!); when.setDate(when.getDate() + offset);
      const whenStr = when.toISOString().slice(0, 10);
      if (whenStr > today) continue;
      const { data: existing } = await sb.from("reminders")
        .select("id, sent_at").eq("invoice_id", inv.id).eq("step", step).maybeSingle();
      if (existing?.sent_at) continue;
      await sb.from("reminders").upsert(
        { invoice_id: inv.id, step, scheduled_for: whenStr, sent_at: new Date().toISOString() },
        { onConflict: "invoice_id,step" });
      await sb.from("notification_log").insert({
        recipient: "client-ap", template_key: `reminder.${step}`, subject: `Invoice ${inv.invoice_number}`,
        related_id: inv.id,
      });
      if (step === "final21") {
        const { data: cl } = await sb.from("clients").select("auto_hold").eq("id", inv.client_id).single();
        if (cl?.auto_hold) {
          await sb.from("clients").update({ hold_active: true }).eq("id", inv.client_id);
          await log(sb, "worker.auto_hold", { client_id: inv.client_id, invoice: inv.invoice_number });
        }
      }
    }
  }
}

/** 6 — Interest: 1.5%/mo, respects plan freeze */
export async function accrueInterest(sb: SupabaseClient) {
  const today = new Date();
  if (today.getDate() !== 1) return;
  const period = today.toISOString().slice(0, 7);
  const { data: overdue } = await sb.from("invoices")
    .select("id, invoice_number, client_id, total_cents, paid_cents")
    .eq("status", "overdue").eq("interest_frozen", false);
  for (const inv of overdue ?? []) {
    const principal = BigInt(inv.total_cents) - BigInt(inv.paid_cents);
    if (principal <= 0n) continue;
    const interest = pctOf(principal, 150n);
    const marker = `interest:${inv.id}:${period}`;
    const { data: dup } = await sb.from("invoice_line_items")
      .select("id").eq("description", marker).maybeSingle();
    if (dup) continue;
    await sb.from("invoices").update({
      interest_cents: interest.toString(),
      total_cents: (BigInt(inv.total_cents) + interest).toString(),
    }).eq("id", inv.id);
    await sb.from("invoice_line_items").insert({
      invoice_id: inv.id, description: marker, amount_cents: interest.toString(),
    });
    await log(sb, "worker.interest_accrued", { invoice: inv.invoice_number, cents: interest.toString() });
  }
}
