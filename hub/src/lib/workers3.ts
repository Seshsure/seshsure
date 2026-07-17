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

      if (n.template_key.startsWith("reminder.") || n.template_key === "invoice.sent" || n.template_key === "payment.receipt") {
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
      await sb.from("notification_log").update({ sent_at: new Date().toISOString(), provider_id: msgId, recipient: to }).eq("id", n.id);
    } catch (e) {
      await sb.from("notification_log").update({
        failed_at: new Date().toISOString(),
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

  const [{ data: openInv }, { data: pays }, { data: tasks }, { data: runs }] = await Promise.all([
    sb.from("invoices").select("total_cents, paid_cents, due_date, status").in("status", ["sent","viewed","partially_paid","overdue"]),
    sb.from("payments").select("amount_cents, status").in("status", ["authorized","scheduled","submitted","settled"]),
    sb.from("tasks").select("title").is("completed_at", null).order("due_on").limit(8),
    sb.from("production_runs").select("run_number, status").not("status", "in", '("closed")').limit(8),
  ]);
  const ar = (openInv ?? []).reduce((s, i) => s + BigInt(i.total_cents) - BigInt(i.paid_cents), 0n);
  const overdue = (openInv ?? []).filter(i => i.due_date && i.due_date < today);
  const inFlight = (pays ?? []).reduce((s, p) => s + BigInt(p.amount_cents), 0n);

  const html = `
<div style="font-family:-apple-system,Inter,sans-serif;max-width:560px;margin:0 auto;color:#15181A">
<h1 style="font-size:16px">☀️ SeshSure — ${now.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</h1>
<p style="font-family:monospace;font-size:12px;line-height:2">
AR OUTSTANDING: <b>${formatUSD(ar)}</b><br/>
OVERDUE: <b style="color:${overdue.length ? "#B4231F" : "#0D9488"}">${overdue.length} invoice${overdue.length===1?"":"s"}</b><br/>
MONEY IN FLIGHT: <b>${formatUSD(inFlight)}</b></p>
<h2 style="font-size:13px">Your queue</h2>
<ul style="font-size:12px;line-height:1.9">${(tasks ?? []).map(t => `<li>${t.title}</li>`).join("") || "<li>Clear ✓</li>"}</ul>
<h2 style="font-size:13px">Production</h2>
<ul style="font-size:12px;line-height:1.9">${(runs ?? []).map(r => `<li>${r.run_number} — ${r.status.replace("_"," ")}</li>`).join("") || "<li>No open runs</li>"}</ul>
<p style="font-size:11px;color:#8b8f8a">Full picture: hub.seshsure.com/admin</p></div>`;

  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: "SeshSure Hub <hub@seshsure.com>", to: "rob@seshsure.com",
    subject: `☀️ Brief — ${formatUSD(ar)} out · ${overdue.length} overdue · ${(tasks ?? []).length} in queue`,
    html,
  });
  await sb.from("activity_log").insert({ actor_label: "system", action: marker, after: { ar: ar.toString() } });
}
