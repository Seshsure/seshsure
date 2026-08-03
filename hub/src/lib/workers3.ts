// ————— WORKER ROSTER 3: the sender + the daily brief —————
import { SupabaseClient } from "@supabase/supabase-js";
import { sendTemplate } from "./email";
import { formatUSD } from "./money";

/** 11 — The sender: flushes pending notifications into real emails. */
export async function flushNotifications(sb: SupabaseClient) {
  const { data: pending } = await sb.from("notification_log")
    .select("*").is("sent_at", null).is("failed_at", null).limit(50);

  for (const n of pending ?? []) {
    try {
      let to: string | null = null;
      let vars: Record<string, string> = {};

      if (n.template_key === "payment.receipt") {
        // related_id is the PAYMENT id: a receipt is about a payment, and the
        // amount must be what was received — never the invoice's open balance.
        const { data: pay } = await sb.from("payments")
          .select("id, amount_cents, invoice_id").eq("id", n.related_id).single();
        if (!pay) throw new Error("payment gone");
        const { data: inv } = await sb.from("invoices")
          .select("id, invoice_number, client_id").eq("id", pay.invoice_id).single();
        if (!inv) throw new Error("invoice gone");
        const { data: ap } = await sb.from("client_contacts")
          .select("name, email").eq("client_id", inv.client_id).eq("role", "ap").limit(1).maybeSingle();
        const { data: anyC } = ap ? { data: null } : await sb.from("client_contacts")
          .select("name, email").eq("client_id", inv.client_id).limit(1).maybeSingle();
        const c = ap ?? anyC;
        if (!c?.email) throw new Error("no contact email");
        to = c.email;
        vars = {
          id: inv.id, number: inv.invoice_number, name: (c.name ?? "there").split(" ")[0],
          amount: formatUSD(BigInt(pay.amount_cents)),
        };
      } else if (n.template_key.startsWith("reminder.") || n.template_key === "invoice.sent") {
        const { data: inv } = await sb.from("invoices")
          .select("id, invoice_number, total_cents, paid_cents, due_date, client_id").eq("id", n.related_id).single();
        if (!inv) throw new Error("invoice gone");
        const { data: ap } = await sb.from("client_contacts")
          .select("name, email").eq("client_id", inv.client_id).eq("role", "ap").limit(1).maybeSingle();
        const { data: anyC } = ap ? { data: null } : await sb.from("client_contacts")
          .select("name, email").eq("client_id", inv.client_id).limit(1).maybeSingle();
        const c = ap ?? anyC;
        if (!c?.email) throw new Error("no contact email");
        to = c.email;
        vars = {
          id: inv.id, number: inv.invoice_number, name: (c.name ?? "there").split(" ")[0],
          amount: formatUSD(BigInt(inv.total_cents) - BigInt(inv.paid_cents)),
          due: inv.due_date ?? "",
        };
      } else if (n.template_key.startsWith("radar.")) {
        const { data: c } = await sb.from("client_contacts")
          .select("name, email").eq("client_id", n.related_id).eq("role", "purchasing").limit(1).maybeSingle();
        if (!c?.email) throw new Error("no purchasing contact");
        to = c.email;
        vars = { name: (c.name ?? "there").split(" ")[0], runway: n.subject?.match(/[\d.]+/)?.[0] ?? "~4" };
      } else if (n.template_key.startsWith("compliance")) {
        to = "rob@seshsure.com";
        const { data: d } = await sb.from("compliance_deadlines").select("title, due_on").eq("id", n.related_id).maybeSingle();
        vars = { title: d?.title ?? n.subject ?? "Deadline", due: d?.due_on ?? "", days: n.subject?.match(/\d+/)?.[0] ?? "" };
      } else {
        throw new Error(`no route for ${n.template_key}`);
      }

      if (!to) throw new Error("no recipient resolved");
      const msgId = await sendTemplate({ to, templateKey: n.template_key, vars });
      await sb.from("notification_log").update({ sent_at: new Date().toISOString(), provider_id: msgId, recipient: to, status: "sent" }).eq("id", n.id);
    } catch (e) {
      await sb.from("notification_log").update({
        failed_at: new Date().toISOString(), status: "failed",
        error: e instanceof Error ? e.message : "send failed",
      }).eq("id", n.id);
    }
  }
}

/** 12 — The daily brief: Rob's 8:00 AM MT email */
export async function dailyBrief(sb: SupabaseClient) {
  const now = new Date();
  const mtHour = (now.getUTCHours() - 6 + 24) % 24;
  if (mtHour !== 8) return;
  const today = now.toISOString().slice(0, 10);
  const marker = `brief:${today}`;
  const { data: dup } = await sb.from("activity_log").select("id").eq("action", marker).maybeSingle();
  if (dup) return;

  const [{ data: openInv }, { data: pays }, { data: runs }] = await Promise.all([
    sb.from("invoices").select("total_cents, paid_cents, due_date, status, client_id, clients(dba)").in("status", ["sent","viewed","partially_paid","overdue"]),
    sb.from("payments").select("amount_cents, status").in("status", ["authorized","scheduled","submitted","settled"]),
    sb.from("production_runs").select("run_number, status").not("status", "in", '("closed")').limit(8),
  ]);
  const ar = (openInv ?? []).reduce((s, i) => s + BigInt(i.total_cents) - BigInt(i.paid_cents), 0n);
  const inFlight = (pays ?? []).reduce((s, p) => s + BigInt(p.amount_cents), 0n);

  // ————— per-client rollup: owed / overdue / oldest days late —————
  type Row = { name: string; owed: bigint; overdue: bigint; days: number };
  const byClient = new Map<string, Row>();
  for (const i of openInv ?? []) {
    const name = ((i as unknown as { clients?: { dba?: string } }).clients?.dba) ?? "—";
    const key = String(i.client_id ?? name);
    const bal = BigInt(i.total_cents) - BigInt(i.paid_cents);
    const row = byClient.get(key) ?? { name, owed: 0n, overdue: 0n, days: 0 };
    row.owed += bal;
    if (i.due_date && i.due_date < today) {
      row.overdue += bal;
      const late = Math.floor((Date.parse(today) - Date.parse(i.due_date)) / 86400000);
      if (late > row.days) row.days = late;
    }
    byClient.set(key, row);
  }
  const rows = [...byClient.values()].sort((a, b) => (b.overdue > a.overdue ? 1 : b.overdue < a.overdue ? -1 : b.owed > a.owed ? 1 : -1));
  const totalOverdue = rows.reduce((s, r) => s + r.overdue, 0n);

  const ink = "#181818", paper = "#FAF5EA", teal = "#13A89E", red = "#E63946", grey = "#8b8f8a";
  const stat = (label: string, value: string, color = ink) =>
    `<td style="padding:14px 12px;border-right:3px solid ${ink}"><div style="font-size:10px;letter-spacing:2px;color:${grey}">${label}</div><div style="font-size:19px;font-weight:900;color:${color};margin-top:2px">${value}</div></td>`;
  const clientRows = rows.map(r => `
    <tr style="border-bottom:1px solid #e8e2d4">
      <td style="padding:10px 12px;font-weight:700;font-size:13px;color:${ink}">${r.name}</td>
      <td style="padding:10px 12px;text-align:right;font-size:13px;color:${ink}">${formatUSD(r.owed)}</td>
      <td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:${r.overdue > 0n ? 800 : 400};color:${ink}">${r.overdue > 0n ? formatUSD(r.overdue) : "—"}</td>
      <td style="padding:10px 12px;text-align:right;font-size:12px;color:${r.days > 0 ? ink : grey}">${r.days > 0 ? r.days + "d" : "—"}</td>
    </tr>`).join("");

  const html = `
<div style="background:${paper};padding:28px 14px;font-family:-apple-system,'Segoe UI',Inter,Arial,sans-serif;color:${ink}">
<div style="max-width:600px;margin:0 auto">
  <div style="font-size:24px;font-weight:900;letter-spacing:-0.5px">SESHSURE <span style="color:${teal}">MORNING</span></div>
  <div style="font-size:12px;color:${grey};margin:2px 0 18px">${now.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div>

  <table cellpadding="0" cellspacing="0" style="width:100%;background:#fff;border:3px solid ${ink};border-collapse:collapse;margin-bottom:20px"><tr>
    ${stat("OUT", formatUSD(ar))}
    ${stat("OVERDUE", formatUSD(totalOverdue), totalOverdue > 0n ? red : teal)}
    ${stat("IN FLIGHT", formatUSD(inFlight)).replace(`border-right:3px solid ${ink}`, "border-right:none")}
  </tr></table>

  <div style="font-size:11px;font-weight:900;letter-spacing:2px;margin:0 0 6px">CLIENTS</div>
  <table cellpadding="0" cellspacing="0" style="width:100%;background:#fff;border:3px solid ${ink};border-collapse:collapse;margin-bottom:20px">
    <tr style="border-bottom:3px solid ${ink}">
      <th style="padding:8px 12px;text-align:left;font-size:10px;letter-spacing:1.5px;color:${grey}">CLIENT</th>
      <th style="padding:8px 12px;text-align:right;font-size:10px;letter-spacing:1.5px;color:${grey}">OWES</th>
      <th style="padding:8px 12px;text-align:right;font-size:10px;letter-spacing:1.5px;color:${grey}">OVERDUE</th>
      <th style="padding:8px 12px;text-align:right;font-size:10px;letter-spacing:1.5px;color:${grey}">OLDEST</th>
    </tr>
    ${clientRows || `<tr><td colspan="4" style="padding:12px;font-size:12px;color:${grey}">Nothing outstanding</td></tr>`}
  </table>

  <div style="font-size:11px;font-weight:900;letter-spacing:2px;margin:0 0 6px">PRODUCTION</div>
  <div style="background:#fff;border:3px solid ${ink};padding:10px 12px;font-size:12px;line-height:1.9;margin-bottom:20px">
    ${(runs ?? []).map(r => `<b>${r.run_number}</b> — ${r.status.replace("_"," ")}`).join("<br/>") || "No open runs"}
  </div>

  <div style="font-size:11px;color:${grey}">Full picture: <a href="https://hub.seshsure.com/admin" style="color:${teal}">hub.seshsure.com/admin</a><br/>
  SeshSure · Vido Manufacturing and Distribution Corp · 10940 S. Parker Road, Suite 788, Parker, CO 80134<br/>
  Operational report for the account owner.</div>
</div></div>`;

  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: "SeshSure Hub <hub@seshsure.com>", to: "rob@seshsure.com",
    subject: `☀️ Brief — ${formatUSD(ar)} out · ${formatUSD(totalOverdue)} overdue`,
    html,
  });
  await sb.from("activity_log").insert({ actor_label: "system", action: marker, after: { ar: ar.toString() } });
}
