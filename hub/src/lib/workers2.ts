// ————— WORKER ROSTER 2: delivery clock, radar, expiries, deadlines —————
import { SupabaseClient } from "@supabase/supabase-js";

const log = async (sb: SupabaseClient, action: string, detail: Record<string, unknown>) =>
  sb.from("activity_log").insert({ actor_label: "system", action, after: detail });

/** 7 — Delivery & POD: milestone sync → delivered stamps balance due date */
export async function deliveryClock(sb: SupabaseClient) {
  const { data: delivered } = await sb.from("shipments")
    .select("id, order_id, delivered_at")
    .not("delivered_at", "is", null).not("order_id", "is", null);
  for (const s of delivered ?? []) {
    const { data: order } = await sb.from("orders")
      .select("id, order_number, status").eq("id", s.order_id!).single();
    if (order && order.status !== "delivered") {
      await sb.from("orders").update({ status: "delivered" }).eq("id", order.id);
    }
    const { data: bal } = await sb.from("invoices")
      .select("id, invoice_number, due_date, delivery_stamped_at")
      .eq("order_id", s.order_id!).eq("kind", "balance").maybeSingle();
    if (bal && !bal.delivery_stamped_at) {
      const d = new Date(s.delivered_at!).toISOString().slice(0, 10);
      await sb.from("invoices").update({
        due_date: bal.due_date ?? d,
        delivery_stamped_at: s.delivered_at,
      }).eq("id", bal.id);
      await log(sb, "worker.pod_stamped", { invoice: bal.invoice_number, delivered: d });
    }
  }
}

/** 8 — Reorder radar */
export async function reorderRadar(sb: SupabaseClient) {
  const { data: clients } = await sb.from("clients")
    .select("id, dba, legal_name").eq("status", "active");
  for (const c of clients ?? []) {
    const { data: lastOrder } = await sb.from("orders")
      .select("id, order_number, special_instructions, delivery_estimate, created_at, weeks_of_supply, order_items(quantity)")
      .eq("client_id", c.id).eq("status", "delivered")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!lastOrder) continue;
    const qty = (lastOrder.order_items as { quantity: number }[] | null)
      ?.reduce((s, i) => s + Number(i.quantity), 0) ?? 0;
    if (!qty) continue;
    const weeksSupply = lastOrder.weeks_of_supply ?? 8;
    const deliveredAt = new Date(lastOrder.delivery_estimate ?? lastOrder.created_at);
    const weeksElapsed = (Date.now() - deliveredAt.getTime()) / (7 * 864e5);
    const runway = weeksSupply - weeksElapsed;
    const level = runway <= 3 ? "red" : runway <= 4 ? "amber" : null;
    if (!level) continue;
    const { data: existing } = await sb.from("tasks")
      .select("id").eq("client_id", c.id).eq("kind", "radar").is("completed_at", null).maybeSingle();
    if (existing) continue;
    await sb.from("tasks").insert({
      title: `${level.toUpperCase()}: ${c.dba ?? c.legal_name} ~${runway.toFixed(1)}wk of cones left`,
      kind: "radar", client_id: c.id, auto_generated: true,
      due_on: new Date().toISOString().slice(0, 10),
    });
    await sb.from("notification_log").insert({
      recipient: "client-purchasing", template_key: `radar.nudge.${level}`, related_id: c.id,
      subject: "Running low soon? Reorder timing",
    });
    await log(sb, "worker.radar_alert", { client: c.dba ?? c.legal_name, runway: runway.toFixed(1), level });
  }
}

/** 9 — Quote expiry */
export async function expireQuotes(sb: SupabaseClient) {
  const now = new Date().toISOString();
  const { data } = await sb.from("quotes").update({ status: "expired" })
    .eq("status", "open").lt("expires_at", now).select("id");
  if (data?.length) await log(sb, "worker.quotes_expired", { count: data.length });
}

/** 10 — Compliance deadlines */
export async function complianceAlerts(sb: SupabaseClient) {
  const today = new Date();
  const { data: deadlines } = await sb.from("compliance_deadlines")
    .select("*").is("completed_at", null);
  for (const d of deadlines ?? []) {
    const daysOut = Math.ceil((new Date(d.due_on).getTime() - today.getTime()) / 864e5);
    for (const horizon of (d.alert_days ?? [90, 60, 30, 7]) as number[]) {
      if (daysOut !== horizon) continue;
      await sb.from("tasks").insert({
        title: `⚖️ ${d.title} — due in ${horizon} days (${d.due_on})`,
        kind: "compliance", related_id: d.id, auto_generated: true,
        due_on: d.due_on,
      });
      await sb.from("notification_log").insert({
        recipient: "rob", template_key: "compliance.alert", subject: `${d.title} — ${horizon} days`,
        related_id: d.id,
      });
      await log(sb, "worker.compliance_alert", { title: d.title, days_out: horizon });
    }
    if (daysOut < 0) {
      await sb.from("notification_log").insert({
        recipient: "rob", template_key: "compliance.OVERDUE", subject: `⚠️ OVERDUE: ${d.title}`,
        related_id: d.id,
      });
    }
  }
}
