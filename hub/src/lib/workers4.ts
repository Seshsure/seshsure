// ————— WORKER ROSTER 4: watchdogs, expiries, escalation, returns, statements,
//        plans, freight exceptions, win-back, samples, referrals —————
import { SupabaseClient } from "@supabase/supabase-js";
import { formatUSD } from "./money";

const log = async (sb: SupabaseClient, action: string, detail: Record<string, unknown>) =>
  sb.from("activity_log").insert({ actor_label: "system", action, after: detail });

/** 13 — Run watchdog: 48h unconfirmed runs → exceptions */
export async function runWatchdog(sb: SupabaseClient) {
  const cutoff = new Date(Date.now() - 48 * 36e5).toISOString();
  const { data: stale } = await sb.from("production_runs")
    .select("id, run_number, created_at").eq("status", "placed").lt("created_at", cutoff);
  for (const r of stale ?? []) {
    const { data: existing } = await sb.from("tasks")
      .select("id").eq("kind", "run_watchdog").eq("related_id", r.id).is("completed_at", null).maybeSingle();
    if (existing) continue;
    await sb.from("tasks").insert({
      title: `⏱ Run ${r.run_number} unconfirmed 48h+ — nudge the factory`,
      kind: "run_watchdog", related_id: r.id, auto_generated: true,
      due_on: new Date().toISOString().slice(0, 10),
    });
    await log(sb, "worker.run_unconfirmed", { run: r.run_number });
  }
}

/** 14 — Document expiry (client + factory papers) */
export async function documentExpiry(sb: SupabaseClient) {
  const soon = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const { data: docs } = await sb.from("stored_documents")
    .select("id, label, expires_on, client_id, factory_id")
    .not("expires_on", "is", null).lte("expires_on", soon).gte("expires_on", today);
  for (const d of docs ?? []) {
    const { data: existing } = await sb.from("tasks")
      .select("id").eq("kind", "doc_expiry").eq("related_id", d.id).is("completed_at", null).maybeSingle();
    if (existing) continue;
    await sb.from("tasks").insert({
      title: `📄 ${d.label} expires ${d.expires_on} — request renewal`,
      kind: "doc_expiry", related_id: d.id, client_id: d.client_id ?? null, auto_generated: true,
      due_on: d.expires_on,
    });
  }
}

/** 15 — Task escalation: overdue tasks get louder (2/5/10-day tiers) */
export async function taskEscalation(sb: SupabaseClient) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: overdue } = await sb.from("tasks")
    .select("id, title, due_on").is("completed_at", null).lt("due_on", today);
  for (const t of overdue ?? []) {
    const days = Math.floor((Date.now() - new Date(t.due_on).getTime()) / 864e5);
    if (![2, 5, 10].includes(days)) continue;
    await sb.from("notification_log").insert({
      recipient: "rob", template_key: "task.escalation",
      subject: `${days}d overdue: ${t.title}`, related_id: t.id,
    });
  }
}

/** 16 — Returns processor: NO auto-retry — every return is Rob's decision */
export async function returnsProcessor(sb: SupabaseClient) {
  const { data: returned } = await sb.from("payments")
    .select("id, amount_cents, client_id, return_code, return_processed")
    .eq("status", "returned").eq("return_processed", false);
  for (const p of returned ?? []) {
    const { data: allocs } = await sb.from("payment_allocations")
      .select("invoice_id, amount_cents").eq("payment_id", p.id);
    for (const a of allocs ?? []) {
      const { data: inv } = await sb.from("invoices")
        .select("id, invoice_number, total_cents, paid_cents").eq("id", a.invoice_id).single();
      if (!inv) continue;
      const newPaid = BigInt(inv.paid_cents) - BigInt(a.amount_cents);
      await sb.from("invoices").update({
        paid_cents: (newPaid < 0n ? 0n : newPaid).toString(),
        status: "overdue",
      }).eq("id", inv.id);
    }
    await sb.from("payments").update({ return_processed: true }).eq("id", p.id);
    await sb.from("clients").update({ watch_flag: true }).eq("id", p.client_id);
    await sb.from("tasks").insert({
      title: `🔴 ACH RETURNED (${p.return_code ?? "code?"}) — ${formatUSD(BigInt(p.amount_cents))} — your call on next step`,
      kind: "ach_return", related_id: p.id, client_id: p.client_id, auto_generated: true,
      due_on: new Date().toISOString().slice(0, 10),
    });
    await log(sb, "worker.return_processed", { payment: p.id, code: p.return_code });
  }
}

/** 17 — Monthly statements (1st; only clients with open activity) */
export async function monthlyStatements(sb: SupabaseClient) {
  const now = new Date();
  if (now.getDate() !== 1) return;
  const period = now.toISOString().slice(0, 7);
  const marker = `statements:${period}`;
  const { data: dup } = await sb.from("activity_log").select("id").eq("action", marker).maybeSingle();
  if (dup) return;

  const { data: clients } = await sb.from("clients").select("id, dba, legal_name").eq("status", "active");
  let sent = 0;
  for (const c of clients ?? []) {
    const { data: open } = await sb.from("invoices")
      .select("id").eq("client_id", c.id)
      .in("status", ["sent","viewed","partially_paid","overdue"]).limit(1);
    if (!open?.length) continue;
    await sb.from("notification_log").insert({
      recipient: "client-ap", template_key: "statement.monthly",
      subject: `Statement — ${period}`, related_id: c.id,
    });
    sent++;
  }
  await log(sb, marker, { sent });
}

/** 18 — Plan watchdog: missed installments → acceleration + unfreeze + Rob task */
export async function planWatchdog(sb: SupabaseClient) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: due } = await sb.from("plan_installments")
    .select("id, plan_id, seq, due_on, amount_cents, cleared_at, payment_plans!inner(id, client_id, status, acceleration, case_label)")
    .lt("due_on", today).is("cleared_at", null);
  for (const inst of due ?? []) {
    const plan = inst.payment_plans as unknown as { id: string; client_id: string; status: string; acceleration: boolean; case_label: string | null };
    if (plan.status !== "active") continue;
    await sb.from("payment_plans").update({ status: "defaulted" }).eq("id", plan.id);
    await sb.from("invoices").update({ interest_frozen: false }).eq("client_id", plan.client_id);
    await sb.from("tasks").insert({
      title: `⚖️ PLAN DEFAULT${plan.case_label ? ` (${plan.case_label})` : ""}: installment #${inst.seq} missed — ${plan.acceleration ? "FULL BALANCE NOW DUE (acceleration)" : "your call"}`,
      kind: "plan_default", related_id: plan.id, client_id: plan.client_id, auto_generated: true,
      due_on: today,
    });
    await sb.from("activity_log").insert({ actor_label: "system", action: "worker.plan_defaulted",
      after: { plan: plan.id, installment: inst.seq } });
  }
}

/** 19 — Freight exceptions: no-scan, ETA slip, demurrage clock */
export async function freightExceptions(sb: SupabaseClient) {
  const { data: active } = await sb.from("shipments")
    .select("id, status, last_scan_at, eta, free_days, arrived_port_at, delivered_at")
    .is("delivered_at", null).not("status", "in", '("booking")');
  const now = Date.now();
  for (const s of active ?? []) {
    const open = async (kind: string, detail: string) => {
      const { data: dup } = await sb.from("logistics_exceptions")
        .select("id").eq("shipment_id", s.id).eq("kind", kind).is("resolved_at", null).maybeSingle();
      if (dup) return;
      await sb.from("logistics_exceptions").insert({ shipment_id: s.id, kind, detail });
      await sb.from("tasks").insert({
        title: `🚨 FREIGHT ${kind.replace(/_/g, " ").toUpperCase()}: ${detail}`,
        kind: "freight_exception", related_id: s.id, auto_generated: true,
        due_on: new Date().toISOString().slice(0, 10),
      });
    };
    if (s.last_scan_at && now - new Date(s.last_scan_at).getTime() > 5 * 864e5)
      await open("no_scan", `no tracking scan in ${Math.floor((now - new Date(s.last_scan_at).getTime()) / 864e5)} days`);
    if (s.eta && s.eta < new Date().toISOString().slice(0, 10))
      await open("eta_slip", `ETA ${s.eta} passed without delivery`);
    if (s.arrived_port_at && s.free_days) {
      const used = Math.floor((now - new Date(s.arrived_port_at).getTime()) / 864e5);
      const left = s.free_days - used;
      if (left <= 2) await open("demurrage_risk", `${left <= 0 ? "DEMURRAGE ACCRUING" : `${left} free day${left === 1 ? "" : "s"} left`} at port`);
    }
  }
}

/** 20 — Win-back autopilot: dormant at 2× expected reorder gap */
export async function winBack(sb: SupabaseClient) {
  const { data: clients } = await sb.from("clients")
    .select("id, dba, legal_name, last_order_at, expected_reorder_weeks, dormant")
    .eq("status", "active").eq("dormant", false).not("last_order_at", "is", null);
  const now = Date.now();
  for (const c of clients ?? []) {
    const weeks = c.expected_reorder_weeks ?? 8;
    const gap = (now - new Date(c.last_order_at!).getTime()) / (7 * 864e5);
    if (gap < weeks * 2) continue;
    await sb.from("clients").update({ dormant: true }).eq("id", c.id);
    await sb.from("tasks").insert({
      title: `💤 ${c.dba ?? c.legal_name} went dormant (${gap.toFixed(0)}wk vs ${weeks}wk expected) — win-back running`,
      kind: "winback", client_id: c.id, auto_generated: true,
      due_on: new Date().toISOString().slice(0, 10),
    });
    await sb.from("notification_log").insert({
      recipient: "client-purchasing", template_key: "winback.first", related_id: c.id,
      subject: "We miss you — anything we could do better?",
    });
    await log(sb, "worker.dormant_flagged", { client: c.id });
  }
}

/** 21 — Sample follow-ups: +3 and +10 day tasks */
export async function sampleFollowups(sb: SupabaseClient) {
  const now = Date.now();
  const { data: samples } = await sb.from("sample_shipments")
    .select("id, prospect_id, shipped_at, followup_3_done, followup_10_done, prospects(company)")
    .not("shipped_at", "is", null);
  for (const s of samples ?? []) {
    const days = (now - new Date(s.shipped_at!).getTime()) / 864e5;
    const company = (s.prospects as unknown as { company: string } | null)?.company ?? "prospect";
    if (days >= 3 && !s.followup_3_done) {
      await sb.from("tasks").insert({
        title: `📞 Sample day-3: call ${company} — first impressions`,
        kind: "sample_followup", related_id: s.id, auto_generated: true,
        due_on: new Date().toISOString().slice(0, 10),
      });
      await sb.from("sample_shipments").update({ followup_3_done: true }).eq("id", s.id);
    }
    if (days >= 10 && !s.followup_10_done) {
      await sb.from("tasks").insert({
        title: `📞 Sample day-10: close ${company} — decision time`,
        kind: "sample_followup", related_id: s.id, auto_generated: true,
        due_on: new Date().toISOString().slice(0, 10),
      });
      await sb.from("sample_shipments").update({ followup_10_done: true }).eq("id", s.id);
    }
  }
}

/** 22 — Referral credits: referred client's first order SETTLES → $1/1,000 credit */
export async function referralCredits(sb: SupabaseClient) {
  const { data: pending } = await sb.from("referral_credits")
    .select("id, referred_client_id").is("granted_at", null);
  for (const r of pending ?? []) {
    const { data: firstPaid } = await sb.from("payments")
      .select("id, cleared_at").eq("client_id", r.referred_client_id)
      .eq("status", "cleared").order("cleared_at").limit(1).maybeSingle();
    if (!firstPaid) continue;
    const { data: firstOrder } = await sb.from("orders")
      .select("id, order_items(quantity)").eq("client_id", r.referred_client_id)
      .order("created_at").limit(1).maybeSingle();
    const cones = ((firstOrder?.order_items ?? []) as { quantity: number }[])
      .reduce((s, i) => s + Number(i.quantity), 0);
    const credit = BigInt(Math.floor(cones / 1000)) * 100n;
    await sb.from("referral_credits").update({
      cones_ordered: cones, credit_cents: credit.toString(),
      granted_at: new Date().toISOString(), first_order_settled_at: firstPaid.cleared_at,
    }).eq("id", r.id);
    await log(sb, "worker.referral_credited", { referral: r.id, credit_cents: credit.toString() });
  }
}

/** 23 — Demand-letter drafter: 30d+ overdue, no plan, no dispute → draft queued for Rob's one tap.
    NEVER auto-sends. The letter is Rob's signature; the machine only writes the first draft. */
export async function demandLetterDrafts(sb: SupabaseClient) {
  const cutoff = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const { data: overdue } = await sb.from("invoices")
    .select("id, invoice_number, client_id, total_cents, paid_cents, due_date, dispute_paused")
    .eq("status", "overdue").lte("due_date", cutoff).eq("dispute_paused", false);

  const byClient = new Map<string, typeof overdue>();
  for (const inv of overdue ?? []) {
    if (!byClient.has(inv.client_id)) byClient.set(inv.client_id, []);
    byClient.get(inv.client_id)!.push(inv);
  }

  for (const [clientId, invs] of byClient) {
    // skip if active payment plan or an open draft already exists
    const { data: plan } = await sb.from("payment_plans")
      .select("id").eq("client_id", clientId).eq("status", "active").maybeSingle();
    if (plan) continue;
    const { data: existing } = await sb.from("demand_letters")
      .select("id").eq("client_id", clientId).eq("status", "draft").maybeSingle();
    if (existing) continue;

    const { data: client } = await sb.from("clients")
      .select("legal_name, dba").eq("id", clientId).single();
    if (!client) continue;

    const total = invs!.reduce((s, i) => s + BigInt(i.total_cents) - BigInt(i.paid_cents), 0n);
    const invoiceList = invs!.map(i => `  • Invoice ${i.invoice_number} — ${formatUSD(BigInt(i.total_cents) - BigInt(i.paid_cents))} (due ${i.due_date})`).join("\n");
    const dl = new Date(Date.now() + 10 * 864e5).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const draft = `FORMAL DEMAND FOR PAYMENT

${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}

To: ${client.legal_name}${client.dba ? ` d/b/a ${client.dba}` : ""}
From: Vido Manufacturing and Distribution Corp d/b/a SeshSure
      10940 S. Parker Rd, Suite 788, Parker, CO 80134

Re: Outstanding balance of ${formatUSD(total)}

This letter is formal demand for payment of the following past-due invoices:

${invoiceList}

TOTAL DUE: ${formatUSD(total)}, plus contractual interest at 1.5% per month continuing to accrue.

Demand is hereby made for payment in full no later than ${dl}. Payment may be made through your SeshSure portal, by wire, or by certified funds mailed to the address above.

If payment in full is not received by that date, we will pursue all remedies available under our agreement and Colorado law, including filing suit in Douglas County, Colorado — the venue you agreed to — and seeking the balance, accrued interest, court costs, and all other recoverable amounts. Your personal guarantee, where applicable, will be enforced.

We would prefer to resolve this without litigation. If circumstances warrant a structured payment plan, contact us before the deadline above.

This letter is written in furtherance of settlement. Nothing herein waives any right or remedy, all of which are expressly reserved.

Vido Manufacturing and Distribution Corp d/b/a SeshSure`;

    const { data: letter } = await sb.from("demand_letters").insert({
      client_id: clientId, invoice_ids: invs!.map(i => i.id),
      total_demanded_cents: total.toString(), draft_text: draft,
    }).select("id").single();

    await sb.from("tasks").insert({
      title: `⚖️ Demand letter drafted: ${client.dba ?? client.legal_name} — ${formatUSD(total)} · review & send`,
      kind: "demand_letter", related_id: letter?.id, client_id: clientId, auto_generated: true,
      due_on: new Date().toISOString().slice(0, 10),
    });
    await log(sb, "worker.demand_drafted", { client: clientId, total_cents: total.toString() });
  }
}
