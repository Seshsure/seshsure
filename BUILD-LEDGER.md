# SESHSURE HUB — BUILD LEDGER (feature completion tracker)
_Every discussed feature, its status, and where it lives. Updated each build pass. ✅ operational · 🔧 partial · 📋 queued · 🔒 on hold_

## Money core
✅ BigInt money math (cents/microcents, half-up) — lib/money.ts
✅ Gap-free SS numbering (atomic counter) — 0009 + lib/invoice.ts
✅ Pricing ladder (override→tier→error) — lib/pricing.ts
✅ Per-cone display everywhere — throughout
✅ Flagship 15¢ PROFIT floor w/ landed-cost math + no-cost-basis block — api/orders/approve
✅ Credit ceiling live-exposure block — api/orders/approve
✅ Deposit dial 0/25/50/100 + auto deposit invoice + 14-day expiry — approve + worker 4
✅ Cleared-funds law (method-agnostic cleared_at) — 0008 + workers 1–2
✅ Interest 1.5%/mo idempotent — worker 6
✅ Partial payments (25% floor, per-client toggle path) + overpayment impossible — api/pay
✅ Payment methods per client (ach/wire/check/cash/card) + self-serve switching — 0008/0010 + Money page
✅ Micro-deposit verify (5 attempts, order-agnostic, logged) — api/bank/verify
✅ Fees-to-payer rule + absorb toggle + CO 2% surcharge default — 0010 (fee schedule table 🔒 awaiting written vendor terms)
🔒 Payment rails LIVE wiring — NachaRail + AuthorizeNetRail BUILT; activation awaits written answers (First Citizens ACH agreement; processor sandbox + fee schedule)
✅ Daily batch tap (owner-only, two-tap, amount-showing) — admin/batches
✅ NACHA builder (bank-grade, worker-only generation) — lib/nacha.ts
✅ Returns processor (no auto-retry, reopen+flag+task) — worker 16
📋 Refund flow UI (credit memos exist; ACH-credit refund button)
📋 Cash/check camera-first receipt recording UI (payment_receipts table ready)
📋 Multi-invoice pay in one authorization
📋 Scheduled-payment UI (API supports scheduledFor)

## Order-to-cash
✅ Order approval cockpit (margin, deposit dial, routing) — admin/orders/[id]
✅ Run placement on cleared deposit / zero-deposit / early-start — worker 3
✅ Routing honored (routed_factory_id) — worker 3
✅ POD stamps balance due date — worker 7 (EasyPost webhook live-path 📋)
✅ Reminder ladder + promise-to-pay + dispute pause + final21 auto-hold — worker 5
✅ Invoice list/detail + view evidence + PayPanel — portal
📋 Client order placement flow (new orders + reorder + questionnaire + PO required + proof approval)
📋 Standing orders · order editing · multi-brand layer · order templates
📋 Quotes UI (expiry worker ✅)
📋 Invoice PDF design (awaits logo) · statements PDF · order confirmation PDF

## Disputes module (Part XIV) — core ✅
✅ Filing API (SS-D, window flag, photos required, SLA stamps, quarantine msg)
✅ Client disputes tab · Admin resolution desk · Factory claims queue + firewalled respond
✅ Resolution w/ root cause REQUIRED + scope ruling (lot-wide vs order-specific)
✅ Blast radius (lot-wide only) · Replacement runs $0 on factory fault · Credit memos
✅ Message firewall in RLS (factory↔client never direct)
📋 Dispute detail pages (client + admin full views w/ side-by-side evidence)
📋 QR lot-label scan prefill · sample-return label flow · outcome summary PDF
📋 Defect analytics dashboards · recurrence detection worker · AI photo pre-check knowledge loop
✅ Abuse guardrail data path (dispute frequency → health grade input)

## Multi-factory (Part XV) — core ✅
✅ Run Board: owner post (flagship gate), sealed bids (RLS), decline-with-reason, award→run at bid price
✅ Admin board w/ scorecard-beside-price + sample-size honesty
✅ Factory scorecards as computed view (never typed)
✅ Factory onboarding API: terms/NDA e-sign, payment terms (per ruling: inside onboarding), rate card, spec acks
✅ Flagship gate (board + assignment + approval, triple-enforced)
📋 Factory onboarding wizard UI · qualification-run flip UI
📋 Factories-see-own-scorecard page · quarterly factory review in month-end ritual
📋 Concentration risk on goals dashboard · tariff lens on award screen · flagship second-source file
📋 Compliance drawer per factory (doc expiry worker ✅ watches factory docs)

## Workers (17 live on hourly cron)
✅ 1 settleAndClear · 2 applyCleared · 3 placeRuns · 4 expireDeposits · 5 reminderLadder · 6 interest · 7 deliveryClock · 8 reorderRadar · 9 expireQuotes · 10 complianceAlerts · 11 flushNotifications · 12 dailyBrief · 13 runWatchdog · 14 documentExpiry · 15 taskEscalation · 16 returnsProcessor · 17 monthlyStatements
📋 send-time queue (9am client-local) · win-back autopilot · standing-order generator · recurrence detection

## Portals & platform
✅ Auth (password + email-OTP 2FA + magic link) · role middleware · RLS 167+ policies
✅ Signup wizard (resumable, evidence-capturing, banking-optional)
✅ Portal shell + footer · Admin shell + Command + queues
✅ Email engine + template registry (collections voice) + CAN-SPAM + Rob BCC
📋 Factory portal: runs pages, statement-of-account builder + admin Excel-mirror
📋 Freight slice: Freight Desk bidding, tracking view (US-port-onward), exceptions, demurrage
📋 Legal slice: court-packet export, demand letters, payment plans, judgment tracker
📋 Pipeline: prospects, samples, show mode, referrals
📋 Client 360 · health grades UI · Client Controls panel UI (columns ✅)
📋 Goals dashboard (10M/mo line, concentration risk) · month-end ritual · data room export
📋 AI panels (read-and-draft) · public site · SOP binder · Terms/Privacy drafts
🔒 QB import (awaits CSVs) · deploy (awaits accounts) · logo-dependent design passes

## Standing rules honored in code
Fees to payer · cleared-funds only · flagship never boards · no auto-retry on returns · window flags not rejects · SLAs internal-only · scores computed never typed · contact firewall RLS-enforced · owner-only money actions · evidence append-only
