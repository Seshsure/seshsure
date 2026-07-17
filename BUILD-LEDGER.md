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
✅ Goals dashboard (units/mo vs 10M, T12M revenue vs $10M, blended margin vs 2.5¢ w/ cost-basis honesty flag, concentration) (10M/mo line, concentration risk) · month-end ritual · data room export
📋 AI panels (read-and-draft) · public site · SOP binder · Terms/Privacy drafts
🔒 QB import (awaits CSVs) · deploy (awaits accounts) · logo-dependent design passes

## Standing rules honored in code
Fees to payer · cleared-funds only · flagship never boards · no auto-retry on returns · window flags not rejects · SLAs internal-only · scores computed never typed · contact firewall RLS-enforced · owner-only money actions · evidence append-only


## SAFEGUARDS (added after second container reset)
- ✅ Repo tarball exported to /mnt/user-data/outputs/seshsure-repo.tar.gz EVERY session — survives resets
- ✅ Migration 0011 collision bug fixed during recovery (0003 already owns payment_plans/plan_installments; 0011 now ALTERs instead of duplicating — the lost version would have failed on a live database)
- 🔴 PRIORITY #1 FOR ROB: GitHub account → remote push = permanent, reset-proof storage

- ✅ Client tracking view (/portal/tracking, 4 milestones, RLS-walled) · ✅ Client Controls switchboard (/admin/clients/[id], every flip audited) · ✅ Demand letters: worker 23 drafts at +30d (skips plans/disputes), owner edit/approve/withdraw, email/certified/both

- ✅ Dispute detail (/admin/disputes/[id]): client vs factory stories side-by-side (firewalled, owner-only view), ResolvePanel (cause+scope required, lot-wide blast chip, $0-replacement note), timeline
- ✅ Client roster + health grades (/admin/clients): A–F computed from payment behavior, never typed; <3 invoices = collecting; ACH return caps at D; open overdue blocks A; basis string always shown
- ✅ Factory detail + qualification flips (/admin/factories/[id]): 5-step onboarding checklist, board_eligible flip GUARDED by completed-run check, flagship_approved flip, active toggle — all audited

- ✅ Factory-side onboarding wizard (/factory/onboarding): terms e-sign w/ evidence + spec acknowledgment, gated sequencing
- ✅ Legal drafts (attorney-review flagged): Terms of Use, Privacy Policy, Factory Services Agreement w/ strict customs-valuation clause (forecloses $0.01 goods/services undervaluation — 19 USC 1592; first-sale flagged as the lawful alternative)
- ✅ SOP binder: index + SOPs 01 batch, 03 dispute, 04 ACH return (code-by-code), 05 demand letter, 08 month-end

- ✅ Storage rails (migration 0015): private buckets art (50MB) + dispute-media (100MB), path-per-client RLS walls, factories read dispute evidence for their runs only, never client art
- ✅ Signed direct-to-storage uploads (/api/uploads/sign + uploadDirect): server validates type/size/ownership, browser PUTs straight to storage — big videos never touch Vercel's 4.5MB cap
- ✅ Branded-art flow: ArtUploader in order form → canvas wrap mockup (labeled DIGITAL PREVIEW, portal-internal only) + honest print-readiness verdict (vector passes; raster checked vs 5400×1800 @300DPI wrap target) → art_assets registered → attached to order
- ✅ Dispute filing UI (/portal/disputes/new): full form, camera-capture photos REQUIRED (video alone rejected), video ≤100MB, production-stopped urgency toggle, media kinds recorded

- ✅ PDF engine (pdfkit, serverless-safe): invoice PDF (logo slot auto-embeds public/logo.png when it lands; typographic wordmark until then; PAID/PAST DUE badge, interest line, how-to-pay box w/ cleared-funds recital) + statement-of-account PDF (running balance, cleared payments only, ?forCourt=1 adds business-records recital). Routes RLS-scoped; download buttons on portal invoice + client admin page. Sample PDFs in outputs.
