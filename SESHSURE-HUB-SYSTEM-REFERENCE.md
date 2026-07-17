# SESHSURE HUB — COMPLETE SYSTEM REFERENCE
_Internal document · Vido Manufacturing and Distribution Corp d/b/a SeshSure · July 2026_
_Purpose: full context for any collaborator or AI workspace working on the Hub._

---

## 1. WHAT THE HUB IS

SeshSure Hub (hub.seshsure.com) is the company's operating system: a custom-built B2B platform that replaces QuickBooks and stitches together everything the business runs on — orders, production, freight, invoicing, payments, collections, legal evidence, compliance deadlines, and client/factory communication — in one database with one audit trail.

**Why it exists:** QuickBooks charged percentage-based processing fees (documented: $500 on a single $20,000 payment) and held the books hostage to its payment rails. The Hub separates software from money movement permanently: the software is owned, and payment rails are swappable commodity vendors plugged into a socket.

**Design philosophy:**
- One database spine — every screen is a different window onto the same rows; nothing is entered twice
- The machine runs itself; Rob taps to approve the moments that matter (3 taps per order lifecycle, 1 tap per day for money release)
- Every rule enforced twice: in the API and in the database (row-level security)
- Evidence as a by-product — every action logs actor, timestamp, before/after; invoice views, signatures (with IP/user-agent), and payment authorizations are court-packet-ready by default
- Everything is per-client configurable (deposits, credit ceilings, payment methods, fee absorption, auto-hold)

---

## 2. ARCHITECTURE & STACK

| Layer | Technology |
|---|---|
| App framework | Next.js 14 (App Router), TypeScript (ES2020), Tailwind |
| Database | Supabase (Postgres) with 167 row-level-security policies, deny-by-default |
| Auth | Supabase Auth — password + 6-digit email OTP (email 2FA), magic-link alternative |
| Hosting | Vercel Pro; hourly cron hits the worker artery |
| Email | Resend — template registry, CAN-SPAM footers, Rob BCC'd on all outbound |
| Shipping | EasyPost (tracking webhooks + safety-net polling) |
| Payments | Dual rail (see §6) |
| Money math | BigInt only — integer cents and microcents (1¢ = 10,000 microcents); floating point structurally impossible; defined half-up rounding |

**Repo layout:** `/supabase/migrations/0001–0010` (schema, RLS, seeds, functions) · `/hub` (Next.js app, 22+ routes) · GO-LIVE.md runbook.

---

## 3. THE FOUR SURFACES

### Admin portal (/admin) — Rob + staff, dark theme
- **Command** — live KPIs (AR outstanding, overdue, ready-to-release, awaiting-you) and a self-assembling action queue (submitted orders, QC photo gates, today's payment batch). Empty state confirms health.
- **Clients** — CRM, per-client controls (deposit %, credit ceiling, payment methods, surcharge absorb, auto-hold), health grades
- **Freight** — lanes, forwarder bids, shipment tracking, exceptions
- **Legal** — collections ladder status, evidence bundles, court-packet generation, compliance docket
- **Pipeline** — quotes, samples, win-back
- **Control** — settings, goals, agreement versions, activity log
- **Batches** — the daily money tap: owner-only, two-tap confirm showing the dollar total

### Client portal (/portal) — light theme
Home (needs-you panel) · Orders (place/track) · Invoices (open/paid ledger → tap-to-detail with line items → Pay panel) · Money (switch payment method, verify bank via micro-deposits) · Documents (signed agreements, resale certs, COAs). Enterprise footer on every page.

### Factory portal (/factory)
Runs (confirm, promise dates) · Shipping (booking info) · Quality (photo gates) · Money (statement of account with line-builder; admin sees a live Excel-style mirror with export) · Account.

### Public site (seshsure.com)
Marketing + signup entry. Signup wizard: invite email (tracked, day-3 auto-reminder) → account creation → company info → multi-member team with role chips → multi-address shipping with per-address receiver name/phone → per-state resale certs → agreements (typed-name signature + title + IP + user-agent recorded against the exact agreement version) → payment method chooser. Resumable server-side state machine; banking never blocks completion.

---

## 4. THE ORDER LIFECYCLE (3 taps)

1. **Client submits order** (or Rob drafts it) — pricing resolved server-side: per-client override → volume tier → error (never guesses)
2. **TAP 1 — Rob approves.** The approval endpoint enforces, in order: client not on hold → **flagship profit floor** (price − landed cost ≥ 15¢/cone, landed = latest factory rate + sea freight adder; blocks with full math and minimum price shown; blocks if no cost basis on file) → **credit ceiling** (live exposure incl. this order; blocks with numbers) → deposit dial (order % → client default → 50%) → order number assigned (atomic, gap-free) → deposit invoice born (SS-numbered, due on receipt) → 14-day expiry stamped
3. **Deposit clears → run places itself** (worker). Zero-deposit or early-start override skips straight to placement.
4. **TAP 2 — QC photo gate.** Factory uploads photos; shipping blocked until Rob approves.
5. Freight books, tracks; **delivery (POD) stamps the balance invoice's due date** — payment clock starts at the dock, automatically
6. **TAP 3 — daily batch release** covers the money coming in (§6)

Reminder ladder, interest, and holds run themselves (§7).

---

## 5. MONEY RULES (locked)

- **All prices display per-cone** (e.g., 6.10¢/cone), never per-thousand. Sole exception: referral credit ($1/1,000).
- **Flagship floor = 15¢ PROFIT per cone** (price minus landed cost), enforced at approval. Contract-manufacturing margin target ~2.5¢ is advisory, dashboard-only.
- **Cleared funds are the only truth.** `cleared_at` governs production starts, hold releases, and legal dismissals. ACH: settlement + 2 business days no return. Check: bank shows *collected* funds (not merely deposited). Cash: on receipt, numbered receipt generated. Nothing downstream reads "deposited" or "settled."
- **Deposits:** default 50%, per-client/per-order dial, 0% allowed (starts production immediately). Unpaid deposit = order auto-expires day 14, invoice voided with reason.
- **Interest:** 1.5%/month simple on overdue principal, billed the 1st, idempotent per invoice-period.
- **Partial payments:** allowed with a 25% floor (per-client toggle), enforced server-side. Payments capped at remaining balance — overpayment impossible.
- **True COGS vs customs value are separate truths.** The margin engine reads run_true_cogs (goods + services + freight + duties + fees) and is forbidden from reading customs declared value.

---

## 6. PAYMENT ARCHITECTURE (dual rail, fees to payer)

**Standing rule: all processing fees pass to the payer.** The company's collected dollar arrives whole. A per-client `absorb_card_fee` toggle exists as a deliberate exception (relationship cost, surfaced in that client's margin view).

| Method | Rail | Cost to SeshSure |
|---|---|---|
| ACH (portal pay) | **First Citizens treasury** — direct NACHA origination; Hub builds bank-grade NACHA files | ~$1 flat/item |
| Card | **Authorize.net** (via processor relationship) — stored CIM profiles, sandbox/prod switch built | Surcharge rides on payer (Colorado cap: 2% or actual cost, whichever lower; surcharge legality follows the customer's state; debit never surchargeable) |
| Wire | instructions on invoice | payer's bank fee |
| Check | payable to Vido Mfg & Dist Corp, Parker CO | a stamp |
| Cash | arranged directly, numbered receipts | zero |

**The flow (ACH):** client signs ACH authorization once at onboarding → each payment is a one-tap approval in the portal → server validates (session → drawer → payable → amount ≤ remaining → 25% floor → verified bank → scheduled ≤ due date) → writes payment + allocation + **append-only authorization evidence** (name, amount, invoice numbers, IP, user-agent, timestamp) → joins the day's batch → **Rob's one daily tap releases the batch** (owner-only, two-tap confirm showing the total) → NACHA file generates in a service-role worker (account data never touches request contexts) → settlement clock runs → cleared funds apply themselves to invoices.

**Bank verification:** micro-deposits, 5 attempts max then support-locked, order-agnostic matching, every attempt logged.

**Fee schedule design (build pending written vendor terms):** fees live in a schedule table (method → flat + %), computed at payment time, shown before authorization, posted as separate line items. Card surcharge default corrected to 200bps for Colorado's cap.

**Status: payment build is ON HOLD pending written answers** from the processor (rates, level 2/3, surcharge program state-handling, fee schedule, contract term, category approval in writing, sandbox credentials) and First Citizens treasury (ACH origination agreement, file submission method, cutoffs, per-item pricing).

---

## 7. THE WORKERS (hourly cron artery, CRON_SECRET-guarded)

Each job idempotent, individually failable, health-logged:
1. **settleAndClear** — submitted → settled (next business day) → cleared (+2 business days, no return)
2. **applyClearedToInvoices** — cleared money applies itself; statuses flip to partially_paid/paid
3. **placeRuns** — deposit paid (or zero-deposit/early-start) → production run created, order → in_production
4. **expireStaleDeposits** — day-14 unpaid deposits expire orders, void invoices with reason
5. **reminderLadder** — due/+3/+7/+14/final21; overdue flip; promise-to-pay and disputes pause it; final21 auto-hold per client toggle
6. **accrueInterest** — 1.5%/mo on the 1st, idempotent
7. **deliveryClock** — POD stamps balance due dates (EasyPost webhook = live path; this is the safety net)
8. **reorderRadar** — runway per client (weeks supply − elapsed); amber ≤4wk, red ≤3wk; one alert per episode; client nudge + Rob task
9. **expireQuotes** — 7-day quote expiry
10. **complianceAlerts** — docket deadlines at 90/60/30/7; overdue items scream daily until completed
11. **flushNotifications** — the sender: resolves each notification to the right human (AP contact for invoices, purchasing for radar, Rob for compliance); failures record their reason
12. **dailyBrief** — Rob's 8:00 AM MT email: AR, overdue, money in flight, task queue, open runs; subject line carries the numbers

**Roster planned next:** monthly statements (1st), send-time queue (9am client-local), win-back autopilot (2× reorder gap), run watchdog (48h unconfirmed), document expiry (certs/W-8/licenses), task escalation, NSF/returns processor (fee + ladder resume).

## 8. EMAIL SYSTEM

Template registry in code (one voice, Rob-editable later): invoice.sent, reminder ladder with escalating collections tone (friendly → nudge → interest accruing → action needed → final notice: orders paused, formal collection next, paying stops everything), radar nudges (client's own runway number), compliance alerts, payment receipts. Every message: CAN-SPAM footer (entity, Parker address, why-receiving), reply-to rob@, **Rob BCC'd by default**. Reminder emails invite dispute-by-reply before escalation.

## 9. SECURITY & EVIDENCE

- **167 RLS policies, deny-by-default.** Clients see only their drawer (prices via function, never raw reads). Factory sees runs/ledger, never client contacts or sell prices. Staff never sees bank data, batches, margins, rate cards, goals, settlements, or strategic CRM (owner-only).
- Append-only tables: signatures, ACH authorizations, invoice views, activity log
- Middleware role-routing on every request; deactivated accounts stopped at the gate; wrong doors redirect
- Bank/account data: vault-only, decrypted solely in service-role workers — never in web request contexts
- Workers act above RLS but below the audit log

## 10. ENTERPRISE CHROME (standards, enforced per slice)

Portal footers (© Vido Manufacturing and Distribution Corp d/b/a SeshSure · Parker address · Terms · Privacy · support) · Terms/Privacy accepted at first login, recorded as signatures · invoice blocks (remit-to per method, terms reference, EIN, page X/Y) · PDF document control (doc ID, version, timestamp) · public security page · one entities record sources all legal identity everywhere.

## 11. CURRENT BUILD STATUS

**Built, compiling, committed (22+ routes):** money library · auth + email 2FA · role middleware · full signup wizard (resumable, validated, evidence-capturing) · portal shell + invoices + tap-to-detail (view-evidence) + Pay panel + Money page (method switching, micro-deposit verify) · admin shell + live Command + Batches + release tap · order approval endpoint (profit floor, credit ceiling, deposit dial, gap-free numbering) · NACHA builder · Authorize.net rail (cards) · per-method rail routing · 12 workers wired to hourly cron · email engine + templates · migrations 0001–0010 validated.

**Preview:** seshsure-hub-complete.jsx — approved visual reference for all remaining screens.

**Build order remaining:** factory portal pages → admin order-approval UI → freight slice → collections/legal packet generation → statements → AI panels (read-and-draft only in v1) → public site → invoice PDF design (awaits logo) → SOP binder.

## 12. PENDING INPUTS (gates)

1. **Accounts** (GO-LIVE.md): GitHub, Supabase Pro, Vercel Pro, Resend, EasyPost, 1Password — all under rob@seshsure.com, 2FA, ~$53/mo → then deploy same day
2. **Processor answers in writing** — rates/level 2-3, surcharge program state handling, full fee schedule, contract term, category approval, sandbox keys
3. **First Citizens treasury** — ACH origination agreement, submission method, cutoffs, pricing
4. **QuickBooks CSVs** (Invoice List, Transaction List by Customer, Customer Contact List) → history import → penny-perfect reconciliation → QB retired
5. **Logo/brand files** → invoice PDF design pass + portal polish
6. **Factory rate card** (xlsx preferred) → seeds pricing + landed-cost bases

---
_This document reflects locked decisions. Changes to money rules, floors, or security posture require explicit sign-off from Rob._
