// ————— EMAIL ENGINE: one sender, one voice, compliant everywhere —————
import { Resend } from "resend";

const FOOTER = `
<div style="margin-top:28px;padding-top:14px;border-top:1px solid #E4E1DA;font-family:monospace;font-size:10px;color:#8b8f8a;line-height:1.7">
Vido Manufacturing and Distribution Corp d/b/a SeshSure<br/>
10940 S. Parker Rd, Suite 788, Parker, CO 80134<br/>
You're receiving this because you have an account or open business with SeshSure.<br/>
Questions? Reply here or write support@seshsure.com — a human reads everything.
</div>`;

const wrap = (title: string, body: string) => `
<div style="font-family:-apple-system,Segoe UI,Inter,sans-serif;max-width:560px;margin:0 auto;color:#15181A">
  <div style="padding:18px 0;font-weight:800;font-size:15px">SESHSURE<span style="color:#0D9488"> HUB</span></div>
  <h1 style="font-size:17px;margin:0 0 10px">${title}</h1>
  ${body}
  ${FOOTER}
</div>`;

const btn = (label: string, href: string) =>
  `<a href="${href}" style="display:inline-block;margin:14px 0;padding:11px 20px;background:#0D9488;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px">${label}</a>`;

type Vars = Record<string, string>;
const HUB = process.env.HUB_URL ?? "https://hub.seshsure.com";

export const TEMPLATES: Record<string, (v: Vars) => { subject: string; html: string }> = {
  "invoice.sent": (v) => ({
    subject: `Invoice ${v.number} — ${v.amount}`,
    html: wrap(`Invoice ${v.number}`, `
      <p style="font-size:13px;line-height:1.6">Hi ${v.name} — your invoice for <b>${v.amount}</b> is ready${v.due ? `, due <b>${v.due}</b>` : ""}. View it, download the PDF, or pay in one tap:</p>
      ${btn("View & pay", `${HUB}/portal/invoices/${v.id}`)}`),
  }),
  "reminder.due": (v) => ({
    subject: `Invoice ${v.number} is due today — ${v.amount}`,
    html: wrap("Due today", `
      <p style="font-size:13px;line-height:1.6">Hi ${v.name} — friendly note that invoice <b>${v.number}</b> (${v.amount}) is due today. One tap settles it:</p>
      ${btn("Pay now", `${HUB}/portal/invoices/${v.id}`)}`),
  }),
  "reminder.plus3": (v) => ({
    subject: `Invoice ${v.number} — 3 days past due`,
    html: wrap("A quick nudge", `
      <p style="font-size:13px;line-height:1.6">Hi ${v.name} — invoice <b>${v.number}</b> (${v.amount}) went past due 3 days ago. If it's already handled, ignore this; if something's off with the invoice, hit reply and we'll fix it fast.</p>
      ${btn("View invoice", `${HUB}/portal/invoices/${v.id}`)}`),
  }),
  "reminder.plus7": (v) => ({
    subject: `Invoice ${v.number} — one week past due`,
    html: wrap("One week past due", `
      <p style="font-size:13px;line-height:1.6">Hi ${v.name} — <b>${v.number}</b> (${v.amount}) is now a week past due. Per our agreement, past-due balances accrue 1.5%/month. Let's get it settled — or if you need a few days, tell us a date and we'll note it.</p>
      ${btn("Pay now", `${HUB}/portal/invoices/${v.id}`)}`),
  }),
  "reminder.plus14": (v) => ({
    subject: `Invoice ${v.number} — two weeks past due — action needed`,
    html: wrap("Action needed", `
      <p style="font-size:13px;line-height:1.6">Hi ${v.name} — <b>${v.number}</b> (${v.amount}) is two weeks past due and interest is accruing. We want to keep this easy: pay below, or reply with a firm date.</p>
      ${btn("Pay now", `${HUB}/portal/invoices/${v.id}`)}`),
  }),
  "reminder.final21": (v) => ({
    subject: `FINAL NOTICE — Invoice ${v.number}`,
    html: wrap("Final notice", `
      <p style="font-size:13px;line-height:1.6">${v.name} — invoice <b>${v.number}</b> (${v.amount}) is 21 days past due. New orders are paused on your account until it's resolved, and continued non-payment moves this to formal collection under our agreement. Paying now stops everything:</p>
      ${btn("Pay now", `${HUB}/portal/invoices/${v.id}`)}`),
  }),
  "radar.nudge.amber": (v) => ({
    subject: "Reorder timing — avoid a gap",
    html: wrap("Running low soon?", `
      <p style="font-size:13px;line-height:1.6">Hi ${v.name} — at your usual pace you've got about <b>${v.runway} weeks</b> of cones left. With current production + transit times, ordering this week keeps you seamless:</p>
      ${btn("Start a reorder", `${HUB}/portal/orders`)}`),
  }),
  "radar.nudge.red": (v) => ({
    subject: "Heads up — cone runway is short",
    html: wrap("Let's not run out", `
      <p style="font-size:13px;line-height:1.6">Hi ${v.name} — you're at roughly <b>${v.runway} weeks</b> of supply. That's inside the danger zone given transit times. Reorder now (or call Rob directly) and we'll fast-track what we can:</p>
      ${btn("Reorder now", `${HUB}/portal/orders`)}`),
  }),
  "compliance.alert": (v) => ({
    subject: `⚖️ ${v.title} — ${v.days} days out`,
    html: wrap(v.title, `<p style="font-size:13px;line-height:1.6">Deadline <b>${v.due}</b> — ${v.days} days away. It's on your docket with a task.</p>${btn("Open docket", `${HUB}/admin/legal`)}`),
  }),
  "payment.receipt": (v) => ({
    subject: `Payment received — ${v.amount}`,
    html: wrap("Thank you — payment received", `
      <p style="font-size:13px;line-height:1.6">Hi ${v.name} — we received <b>${v.amount}</b> toward invoice ${v.number}. Your receipt and updated statement are in your portal.</p>
      ${btn("View receipt", `${HUB}/portal/invoices/${v.id}`)}`),
  }),
};

export async function sendTemplate(args: {
  to: string; templateKey: string; vars: Vars; from?: string; bccOwner?: boolean;
}) {
  const t = TEMPLATES[args.templateKey];
  if (!t) throw new Error(`unknown template ${args.templateKey}`);
  const { subject, html } = t(args.vars);
  const resend = new Resend(process.env.RESEND_API_KEY);
  const res = await resend.emails.send({
    from: args.from ?? process.env.EMAIL_FROM ?? "SeshSure Billing <billing@seshsure.com>",
    to: args.to,
    bcc: args.bccOwner === false ? undefined : "rob@seshsure.com",
    subject, html,
    replyTo: "rob@seshsure.com",
  });
  if (res.error) throw new Error(res.error.message);
  return res.data?.id;
}
