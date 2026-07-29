// ————— EMAIL ENGINE: one sender, one voice, compliant everywhere —————
// Visual system: locked SeshSure brand — warm paper, ink, Memphis brights,
// hard offset shadows. Red is reserved for the single peak-tension moment
// (final notice). Everything inline-styled for email-client survival; the
// offset shadows and display stack degrade gracefully where stripped.
import { Resend } from "resend";

const INK = "#181818";
const PAPER = "#FAF5EA";
const TEAL = "#13A89E";
const PURPLE = "#6C4AB0";
const YELLOW = "#FFC93C";
const ORANGE = "#FF8A3D";
const RED = "#E63946";
const DISPLAY = "'Archivo Black','Arial Black',Arial,sans-serif";
const BODYF = "-apple-system,'Segoe UI',Inter,Helvetica,Arial,sans-serif";

const footer = (kind: "transactional" | "marketing") => `
<div style="margin-top:26px;padding-top:14px;border-top:2px solid ${INK};font-family:'Courier New',monospace;font-size:10px;color:#6b6f6a;line-height:1.8">
${kind === "transactional"
  ? "This is a transactional message regarding your SeshSure account."
  : `You're receiving this because your account has reorder alerts on. <a href="mailto:support@seshsure.com?subject=Unsubscribe%20reorder%20alerts" style="color:#6b6f6a">Unsubscribe from reorder alerts</a>.`}<br/>
Vido Manufacturing and Distribution Corp d/b/a SeshSure<br/>
10940 S. Parker Rd, Suite 788, Parker, CO 80134<br/>
Questions? Reply here or write support@seshsure.com — a human reads everything.
</div>`;

// ————— V3 STREET SHELL — drop-poster energy, email-client survivable —————
// Hazard stripes via repeating-linear-gradient (degrades to solid), stacked
// double shadows, receipt-perforation dividers, faux barcode, deco glyphs.
// No transforms (Gmail strips them) — the grit comes from layering.

const ASSETS = "https://tshqgybviswljhfqtvlu.supabase.co/storage/v1/object/public/email-assets/banners";
const band = (slug: string, label: string, accent: string) =>
  `<img src="${ASSETS}/${slug}.png" width="560" alt="${label}" style="display:block;width:100%;height:auto;border-bottom:4px solid ${INK};background:${accent};color:${INK};font-family:${DISPLAY};font-size:30px;line-height:120px;text-align:center" />`;

// Hero: 54px money with an accent underline slab riding under the digits.
const hero = (main: string, accent: string, sub?: string) => `
  <div style="margin:18px 0 2px">
    <span style="font-family:${DISPLAY};font-size:54px;line-height:1;color:${INK};letter-spacing:-2px;background-image:linear-gradient(${accent},${accent});background-repeat:no-repeat;background-size:100% 16px;background-position:0 82%">${main}</span>
  </div>
  ${sub ? `<div style="font-family:${BODYF};font-size:14px;color:#4a4e49;margin:8px 0 2px">${sub}</div>` : ""}`;

// Receipt ticket: monospace ledger rows between perforation dashes.
const ticket = (rows: [string, string][]) => `
  <div style="margin:16px 0 4px;border-top:2px dashed ${INK};border-bottom:2px dashed ${INK};padding:12px 2px;margin:18px 0 6px">
    ${rows.map(([k, v]) => `<div style="font-family:'Courier New',monospace;font-size:13px;color:${INK};line-height:2.1"><span style="display:inline-block;min-width:46%;font-weight:bold">${k}</span> ${v}</div>`).join("")}
  </div>`;

const barcode = `<div style="margin-top:16px;font-family:'Courier New',monospace;font-size:15px;line-height:1;letter-spacing:-1px;color:#B9B4A6">▌▎▊▏▍▎▉▏▎▊▍▏▌▎▊▏▍▎▌▏▊▎▍▉▏▎▌</div>`;

const wrap = (accent: string, slug: string, badgeLabel: string, title: string, body: string, kind: "transactional" | "marketing" = "transactional") => `
<div style="background:${PAPER};padding:26px 12px;font-family:${BODYF}">
  <div style="max-width:560px;margin:0 auto">
    <div style="padding:0 2px 14px">
      <span style="font-family:${DISPLAY};font-weight:900;font-size:20px;color:${INK};letter-spacing:1px">SESHSURE<span style="color:${accent}"> HUB</span></span>
    </div>
    <div style="background:#FFFDF6;border:4px solid ${INK};box-shadow:8px 8px 0 ${accent}, 16px 16px 0 ${INK}">
      ${band(slug, badgeLabel, accent)}
      <div style="padding:24px 26px 26px;color:${INK}">
        <h1 style="font-family:${DISPLAY};font-size:20px;line-height:1.3;margin:0 0 4px;color:${INK}">${title}</h1>
        ${body}
        ${barcode}
        ${footer(kind)}
      </div>
    </div>
    <div style="padding:18px 2px 0;font-family:${DISPLAY};font-size:13px;letter-spacing:1px;color:${INK}">PUFF<span style="color:${accent}">.</span> PEEL<span style="color:${accent}">.</span> PASS<span style="color:${accent}">.</span>™</div>
  </div>
</div>`;

const btn = (label: string, href: string, accent: string) =>
  `<a href="${href}" style="display:block;text-align:center;margin:18px 0 4px;padding:17px 26px;background:${INK};color:#FFFDF6;border:3px solid ${INK};box-shadow:6px 6px 0 ${accent};text-decoration:none;font-family:${DISPLAY};font-weight:900;font-size:16px;letter-spacing:2.5px;text-transform:uppercase">${label} →</a>`;

const p = (t: string) => `<p style="font-size:15px;line-height:1.7;margin:12px 0;color:${INK}">${t}</p>`;

type Vars = Record<string, string>;
const HUB = process.env.HUB_URL ?? "https://hub.seshsure.com";

export const TEMPLATES: Record<string, (v: Vars) => { subject: string; html: string }> = {
  "invoice.sent": (v) => ({
    subject: `Invoice ${v.number} — ${v.amount}`,
    html: wrap(PURPLE, "invoice", "INVOICE", `Invoice ${v.number}`, `
      ${hero(v.amount, PURPLE)}\n      ${ticket([["INVOICE", v.number], ["DUE", v.due ?? "on receipt"], ["STATUS", "OPEN"]])}
      ${p(`Hi ${v.name} — your invoice is ready. View it, download the PDF, or pay in one tap:`)}
      ${btn("View & Pay", `${HUB}/portal/invoices/${v.id}`, PURPLE)}`),
  }),
  "reminder.due": (v) => ({
    subject: `Invoice ${v.number} is due today — ${v.amount}`,
    html: wrap(YELLOW, "due-today", "DUE TODAY", "Due today", `
      ${hero(v.amount, `invoice ${v.number}`)}
      ${p(`Hi ${v.name} — friendly note that this one's due today. One tap settles it:`)}
      ${btn("Pay Now", `${HUB}/portal/invoices/${v.id}`, YELLOW)}`),
  }),
  "reminder.plus3": (v) => ({
    subject: `Invoice ${v.number} — 3 days past due`,
    html: wrap(YELLOW, "past-due", "PAST DUE", "A quick nudge", `
      ${hero(v.amount, `invoice ${v.number}`)}
      ${p(`Hi ${v.name} — this went past due 3 days ago. If it's already handled, ignore this; if something's off with the invoice, hit reply and we'll fix it fast.`)}
      ${btn("View Invoice", `${HUB}/portal/invoices/${v.id}`, YELLOW)}`),
  }),
  "reminder.plus7": (v) => ({
    subject: `Invoice ${v.number} — one week past due`,
    html: wrap(ORANGE, "week-late", "1 WEEK LATE", "One week past due", `
      ${hero(v.amount, `invoice ${v.number}`)}
      ${p(`Hi ${v.name} — this is now a week past due. Per our agreement, past-due balances accrue 1.5%/month. Let's get it settled — or if you need a few days, tell us a date and we'll note it.`)}
      ${btn("Pay Now", `${HUB}/portal/invoices/${v.id}`, ORANGE)}`),
  }),
  "reminder.plus14": (v) => ({
    subject: `Invoice ${v.number} — two weeks past due — action needed`,
    html: wrap(ORANGE, "action", "ACTION NEEDED", "Two weeks past due", `
      ${hero(v.amount, ORANGE)}\n      ${ticket([["INVOICE", v.number], ["STATUS", "14 DAYS PAST DUE"], ["INTEREST", "ACCRUING"]])}
      ${p(`Hi ${v.name} — we want to keep this easy: pay below, or reply with a firm date.`)}
      ${btn("Pay Now", `${HUB}/portal/invoices/${v.id}`, ORANGE)}`),
  }),
  "reminder.final21": (v) => ({
    subject: `FINAL NOTICE — Invoice ${v.number}`,
    html: wrap(RED, "final-notice", "FINAL NOTICE", "Final notice", `
      ${hero(v.amount, RED)}\n      ${ticket([["INVOICE", v.number], ["STATUS", "21 DAYS PAST DUE"], ["ACCOUNT", "NEW ORDERS PAUSED"]])}
      ${p(`${v.name} — new orders are paused on your account until this is resolved, and continued non-payment moves this to formal collection under our agreement. Paying now stops everything:`)}
      ${btn("Pay Now", `${HUB}/portal/invoices/${v.id}`, RED)}`),
  }),
  "radar.nudge.amber": (v) => ({
    subject: "Reorder timing — avoid a gap",
    html: wrap(TEAL, "radar", "REORDER RADAR", "Running low soon?", `
      ${hero(`~${v.runway} WKS`, TEAL, "of cones left at your usual pace")}
      ${p(`Hi ${v.name} — with current production + transit times, ordering this week keeps you seamless:`)}
      ${btn("Start a Reorder", `${HUB}/portal/orders`, TEAL)}`, "marketing"),
  }),
  "radar.nudge.red": (v) => ({
    subject: "Heads up — cone runway is short",
    html: wrap(ORANGE, "running-low", "RUNNING LOW", "Let's not run out", `
      ${hero(`~${v.runway} WKS`, ORANGE, "of supply — inside the danger zone given transit times")}
      ${p(`Hi ${v.name} — reorder now (or call Rob directly) and we'll fast-track what we can:`)}
      ${btn("Reorder Now", `${HUB}/portal/orders`, ORANGE)}`, "marketing"),
  }),
  "compliance.alert": (v) => ({
    subject: `⚖️ ${v.title} — ${v.days} days out`,
    html: wrap(PURPLE, "docket", "DOCKET", v.title, `
      ${hero(`${v.days} DAYS`, PURPLE, `deadline ${v.due}`)}
      ${p("It's on your docket with a task.")}
      ${btn("Open Docket", `${HUB}/admin/legal`, PURPLE)}`),
  }),
  "system.error": (v) => ({
    subject: `🔴 HUB ERROR — ${v.source}`,
    html: wrap(RED, "final-notice", "SYSTEM", `Hub error — ${v.source}`, `
      ${p(`<b>${v.message}</b>`)}
      ${p(`Source: <code>${v.source}</code> · ${v.time}`)}
      ${p(`Full detail is in the error_log table. Repeats of this exact error are throttled for the next hour.`)}
      ${btn("Open Errors Dashboard", `${HUB}/admin/errors`, RED)}`),
  }),
  "application.received": (v) => ({
    subject: `🟡 New wholesale application — ${v.company}`,
    html: wrap(YELLOW, "due-today", "APPLICATION", `${v.company} wants in`, `
      ${p(`<b>${v.name}</b> · ${v.email} · via ${v.ref}`)}
      ${p("Review the signals and decide in one tap.")}
      ${btn("Review Application", `${HUB}/admin/applications`, YELLOW)}`),
  }),
  "application.approved": (v) => ({
    subject: `You're approved — welcome to SeshSure, ${v.company}`,
    html: wrap(TEAL, "approved", "APPROVED", `Welcome aboard, ${v.name}`, `
      ${p(`<b>${v.company}</b> is approved for a verified wholesale account. One button below — here's what happens after you tap it:`)}
      ${ticket([["1. SET PASSWORD", "only you will know it"], ["2. COMPANY DETAILS", "entity, EIN, licenses"], ["3. YOUR TEAM", "add your AP person"], ["4. SHIPPING", "where cones land"], ["5. AGREEMENT", "sign once, order forever"]])}
      ${p("Takes about ten minutes, saves as you go — leave and come back anytime. The moment the agreement is signed, ordering opens.")}
      ${btn("Start Onboarding", v.link, TEAL)}`),
  }),
  "arcade.application": (v) => ({
    subject: `🕹️ Arcade access application — ${v.name}`,
    html: wrap(PURPLE, "docket", "ARCADE", `${v.name} wants Arcade access`, `
      ${p(`Their note: <i>${v.note}</i>`)}
      ${p("Approving requires attaching the counsel-reviewed sweepstakes rules doc and picking their arcade slug — the compliance gate lives at approval, never at launch.")}
      ${btn("Review in Admin", `${HUB}/admin/arcade`, PURPLE)}`),
  }),
  "payment.receipt": (v) => ({
    subject: `Payment received — ${v.amount}`,
    html: wrap(TEAL, "paid", "PAID.", "Thank you — payment received", `
      ${hero(v.amount, TEAL)}\n      ${ticket([["RECEIVED TOWARD", v.number], ["STATUS", "PAID ✓"], ["RECEIPT", "IN YOUR PORTAL"]])}
      ${p(`Hi ${v.name} — your receipt and updated statement are in your portal.`)}
      ${btn("View Receipt", `${HUB}/portal/invoices/${v.id}`, TEAL)}`),
  }),
};


// ————— SENDER IDENTITY BY OCCASION —————
// Billing speaks on money paperwork; the Hub speaks on access, system, and
// operational nudges. One verified domain, the right voice per email.
const FROM_BY_PREFIX: [string, string][] = [
  ["invoice.",     "SeshSure Billing <billing@seshsure.com>"],
  ["reminder.",    "SeshSure Billing <billing@seshsure.com>"],
  ["payment.",     "SeshSure Billing <billing@seshsure.com>"],
  ["application.", "SeshSure Hub <hub@seshsure.com>"],
  ["system.",      "SeshSure Hub <hub@seshsure.com>"],
  ["compliance.",  "SeshSure Hub <hub@seshsure.com>"],
  ["arcade.",      "SeshSure Hub <hub@seshsure.com>"],
  ["radar.",       "SeshSure <hub@seshsure.com>"],
];
const fromFor = (key: string) =>
  FROM_BY_PREFIX.find(([p]) => key.startsWith(p))?.[1] ?? process.env.EMAIL_FROM ?? "SeshSure Hub <hub@seshsure.com>";

// ————— MASTER SEND SWITCH —————
// Until EMAILS_ENABLED=true in the environment, client-facing mail is suppressed
// (logged as skipped). Auth codes bypass this (they go via Supabase SMTP, not here).
export async function sendTemplate(args: {
  to: string; templateKey: string; vars: Vars; from?: string; bccOwner?: boolean; systemOverride?: boolean;
}) {
  if (process.env.EMAILS_ENABLED !== "true" && !args.systemOverride) {
    console.log(`[email suppressed — EMAILS_ENABLED off] ${args.templateKey} → ${args.to}`);
    return { ok: true, suppressed: true } as const;
  }
  const t = TEMPLATES[args.templateKey];
  if (!t) throw new Error(`unknown template ${args.templateKey}`);
  const { subject, html } = t(args.vars);
  const resend = new Resend(process.env.RESEND_API_KEY);
  const res = await resend.emails.send({
    from: args.from ?? fromFor(args.templateKey),
    to: args.to,
    bcc: args.bccOwner === false ? undefined : "rob@seshsure.com",
    subject, html,
    replyTo: "rob@seshsure.com",
  });
  if (res.error) throw new Error(res.error.message);
  return res.data?.id;
}
