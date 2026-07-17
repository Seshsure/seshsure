# SESHSURE HUB — COMPLETE SYSTEM REFERENCE (FULL DETAIL)
_Internal document · Vido Manufacturing and Distribution Corp d/b/a SeshSure · July 2026_
_Purpose: exhaustive context for any collaborator or AI workspace. This is the master reference — every locked decision from both build sessions (~300 Q&A decisions), the full architecture, all business rules, and current status. Changes to money rules, floors, or security posture require Rob's explicit sign-off._

---

# PART I — WHAT THE HUB IS AND WHY

**SeshSure Hub (hub.seshsure.com)** is the company's complete operating system: a custom-built platform replacing QuickBooks that runs orders, production, freight, invoicing, payments, collections, legal evidence, compliance deadlines, prospect pipeline, and all client/factory communication on one database with one audit trail.

**The origin problem:** QuickBooks charged percentage-based processing (documented: **$500 fee on a single $20,000 payment — 2.5%**) and bundled the software with the payment rails, making the fees hostage-taking. Collections required manual chasing and produced two lawsuits (Douglas County). Paperwork-before-shipping was enforced by memory. Onboarding was manual.

**Goals (original spec):**
1. Zero percentage-based processing fees — direct ACH origination (pennies per transaction)
2. Every payment carries a timestamped, client-initiated authorization — court-ready evidence
3. No product ships without signed paperwork + deposit — enforced by the system, not memory
4. Cut DSO via automated reminders, aging visibility, escalation before things reach Douglas County
5. Clean exportable books — acquirer-ready records for the five-year exit

**Design philosophy:**
- **One database spine** — every screen is a window onto the same rows; nothing entered twice
- **The machine runs itself; Rob taps the moments that matter** — a normal order lifecycle costs Rob exactly **3 taps** (approve order → QC photo gate → covered by the daily batch release); money release is **1 tap per day**
- **Every rule enforced twice** — in the API and in the database (row-level security)
- **Evidence as a by-product** — every action logs actor/timestamp/before-after; signatures, ACH authorizations, and invoice views are append-only and court-packet-ready
- **Everything per-client configurable** — deposits, ceilings, methods, fee absorption, auto-hold, floors
- **Cleared funds are the only truth** (see Part IV)
- Client ↔ Hub ↔ Factory: the client interacts only with the Hub; the factory interacts only with the Hub; the Hub does the bridging so nothing cuts SeshSure out (contact firewall — no names/emails/phones ever cross; non-circumvention clauses in both agreements)

---

# PART II — ARCHITECTURE & STACK

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 14 App Router, TypeScript (target ES2020), Tailwind | 22+ routes built, compiles clean |
| Database | Supabase Postgres, project `tshqgybviswljhfqtvlu` | **167 RLS policies, deny-by-default**; 10 migrations validated |
| Auth | Supabase Auth | Password + auto-sent 6-digit **email OTP (email 2FA — Rob rejected Twilio/SMS and auth apps)**; magic-link alternative for AP users |
| Hosting | Vercel Pro (seshsure team) | Hourly cron hits the worker artery |
| Email | Resend | Template registry, CAN-SPAM footers, Rob BCC'd on everything, reply-to rob@ |
| Shipping | EasyPost | Tracking webhooks (live path) + polling worker (safety net); POD auto-stamps delivery |
| Money math | **BigInt only** | Integer cents + microcents (1¢ = 10,000 microcents); floating point structurally impossible; defined half-up rounding on sub-cent remainders |
| PDF generation | Playwright/Chromium server-side | Invoice PDF design queued — awaits final logo files (Rob has them, will provide) |
| Important constraint | Supabase/Vercel **MCP connectors are bound to testedclear** — SeshSure work uses **CLI only** (`SUPABASE_ACCESS_TOKEN` + `supabase link --project-ref tshqgybviswljhfqtvlu`; Vercel CLI authed as seshsure team) |

**Repo:** `/supabase/migrations/0001–0010` · `/hub` (Next.js app) · GO-LIVE.md runbook · git committed throughout.

**Migrations inventory:**
- 0001–0003: identity/clients/catalog · commerce/production/freight · legal/comms/system (104 statements)
- 0004: **167 RLS policies** (177 stmts) — helper functions is_owner/is_internal/is_client_member/is_factory_member; clients drawer-only (prices via function, never raw reads); factory sees runs/ledger, never client contacts or sell prices; staff never sees bank data, batches, margins, rate card, goals, settlements, strategic CRM (owner-only); evidence tables append-only
- 0005: Vido entity seed + DAP freight lanes (sea 3.5¢/cone = 35,000 microcents... stored as adders; air 4.5¢/cone)
- 0006: duties & taxes — shipments.declared_value_cents; duty_programs (HTS 4813.10.0000; MFN/301/IEEPA rate stack in bps); entry_fee_config (MPF 34.64 bps with min/max, HMF 12.5 bps)
- 0007: TRUE COGS — factory_invoices.kind (goods/services/freight/other); cost_allocations (services→runs per-cone); **run_true_cogs view** (goods + services + freight + duties + fees); margin engine reads this and is FORBIDDEN from reading customs declared value
- 0008: payment methods — clients.accepted_methods[] / preferred_method; entity checks_payable_to + remit address; payment_receipts (numbered, image_path)
- 0009: claim_counter() — atomic row-locked **gap-free** SS numbering
- 0010: card method + card_surcharge_bps (default corrected to **200 bps** for Colorado's 2% cap) + absorb_card_fee per-client toggle

---

# PART III — THE FOUR SURFACES (complete feature inventory)

## A. ADMIN PORTAL (/admin) — Rob + future staff · dark theme, dense, data-first
Rob uses phone and desktop with equal weight — everything responsive.

**Command (home)** — Action queue FIRST (Rob's choice), then KPIs:
- KPIs: AR outstanding · Overdue (ladder status) · Ready to release (today's batch) · Awaiting you (orders + photo gates)
- Action queue self-assembles: submitted orders to approve, QC photo gates, today's payment batch, escalations due, onboarding awaiting review, returns to handle
- Empty state confirms health: "Queue clear — the machine is running itself ✓"
- Morning sweep + pinned items + calm-by-default collapsible sections
- **Hub AI panel** (v1, labeled "answers from your data · drafts only")

**Clients** — full CRM: contacts, docs, bank verification status, terms, notes/activity; client auto-populates from signup. Per-client control panel (the toggles): deposit % · credit ceiling (**everyone gets a ceiling — nobody exempt, including anchors**) · payment methods enabled · absorb card fee · auto-hold at final21 · partial-payment floor on/off · auto-approve repeat orders (**only if zero balance + no missed payments; any issues → manual**) · hold shipments · require prepayment · freeze portal payments (disputes) · health grades (composite, nightly). **Client 360**: complete relationship on one screen. **Pre-call dossier** (v1.5) · **view-as-client (logged)** · client segmentation/tags · per-deal completion summaries (sent to client) · purchase totals visible to client.

**Freight** (the logistics brain — session 2 additions):
- **The Freight Desk**: every shipment goes to bid — multiple forwarders + brokers quote (bidding on every shipment was Rob's explicit choice); directory of carriers; quote comparison; award tap
- Freight paid easily (payables integrated); freight quoting helper on orders (three layers built: estimate at quote → live bids → booked actuals)
- Tracking: client sees **US port/customs onward only** (supply chain opaque before that); EasyPost milestones; exceptions engine (no-scan alerts, ETA slips, demurrage clock)
- Freight insurance handled OUTSIDE the Hub (Rob's call per incident for damage policy)
- Customs: broker bidding; docs auto-flow from factory portal; duties tracked as separate line in landed cost (supports ACE-portal tariff-refund claims); **customs declared value vs TRUE COGS kept as separate truths**

**Legal** —
- Collections ladder per client: reminders → final notice → account hold → **demand letter (auto-drafted, queued for Rob's one-tap approval; delivered email + certified-mail task) at +30 → file at +45** (codified)
- **Any amount — always file** (no minimum balance to sue)
- **Court-ready export**: one click produces the Douglas County packet — invoice PDFs, viewed-at timestamps, authorization records, reminder history, statement of account (everything Virgin Mary and Slow Burn required manually)
- Payment-plan/stipulation tracking v1: any schedule; **interest frozen while the plan is honored**; acceleration flag if a payment returns/misses; scheduled invoices auto-generate
- Judgment tracker v1 · full case tracking + deadlines · settlement tracking with the **cleared-funds rule** (never dismiss until final payment clears)
- Compliance docket: deadlines alert at 90/60/30/7; overdue screams daily

**Pipeline** — prospects (form link, **no login** for prospects), stages: **Lead → simple paperwork → sample → onboarding**. Simple paperwork = company info, shipping + contact, desired cone images, paper type, colors. Samples: **free (sales investment), standard 20 cones** (more on request); unbranded packs ship from Rob's stock, branded come to Rob who delivers; proof approval same as orders; auto-tasks +3/+10 and ONE automated prospect email; **required lead source on every prospect** (feeds pipeline reporting); **show mode** (trade-show quick capture: 15-second entry, post-show task queue, no auto-emails to leads); dormancy = **2× past expected reorder** → win-back autopilot.

**Control** — settings, goals dashboard (**milestone bar + 10M units/month line + $10M annual revenue target**; blended margin target 2.5¢/cone branded+unbranded; flagship ≥15¢), agreement versions (versioned, never edited in place), email templates, product catalog, tax rates, user management, activity log, **monthly reconciliation view** (bank statements vs recorded transactions), **interactive month-end close ritual** (Hub runs the checklist), **one-click data room export** (v1 — always exit-ready: financials, client concentration, retention, contracts), weekly independent backup (emailed download link), **cash forecast: full in/out** (settlements in, factory/freight obligations out), **exit cockpit** (v1.5), **deal simulator** (v1), **anomaly watchdog** (phase 2).

**Batches** — the daily money tap: owner-only (staff gets 403), list of every payment by client + amount, one release button showing the total dollar figure, **two-tap confirm** ("Yes — release $61,400"), recent batch history below. Scheduled payments auto-join their date's batch.

## B. CLIENT PORTAL (/portal) — light theme, unique but easy
Client dashboard: **balance first for everyone** (Rob's choice), then Needs-You panel.

- **Home**: balance, needs-you (proofs to approve, invoices due), order status
- **Orders**: place NEW orders (not just reorders — explicit session-2 correction), one-click reorder, order history with **coarse 4-stage status** (Confirmed / In Production / Shipped / Delivered — supply chain opaque), per-order lead-time estimate set by Rob at confirmation, proof approval (unlimited revisions; reminders at day 2 and 5 on stuck proofs; **production timeline starts at order, not proof approval**), image/art upload (**accept anything — prepress handled internally**; proof gate catches issues), order questionnaire (weeks-of-supply or weekly usage — whichever they answer feeds the reorder radar), PO number **required on every order**, order editing allowed (revise → docs update), standing orders (auto-generate monthly invoice), multi-brand layer (brands → art/proofs/orders, single balance), third-party ship-to addresses supported, order confirmation PDF on every order
- **Invoices**: open/paid ledger, tap-any-invoice → full detail (line items, cone counts, freight/tax/interest lines, remaining balance); **opening an invoice writes an invoice_view evidence row and notifies Rob** (kills "we never received it"); statements monthly (auto-email to AP on the 1st); **invoices that file themselves** (client AP-inbox ingest email captured at onboarding)
- **Pay panel**: editable amount (type any amount — session-2 requirement) + 25/50/Full chips; **25% minimum partial floor (per-client toggle), enforced server-side**; schedule any future date ≤ due date; multi-invoice pay (one authorization, one debit); non-ACH clients see remit instructions instead; payment statuses shown honestly: Authorized → Submitted → Settled → Cleared (→ Returned)
- **Money**: switch preferred method self-serve **among admin-enabled methods only**; bank add + micro-deposit verify (5 attempts max, order-agnostic, attempts logged); one bank account per client, replaceable
- **Documents**: signed agreements, COAs/spec sheets per lot, SeshSure's W-9 (self-serve download), resale certs per state
- Client-side extras (chosen from industry-leading rounds): **QR-coded lots** (scan → COA/spec/lot info) · **one-tap vendor packet** (W-9 + insurance cert + banking letter for their AP onboarding) · volume-lock commitment template + Hub flag · **cone tracker** (Domino's-style order progress, v1) · order templates · **their cone cupboard** (what they've bought, drawdown) · tier-up nudges ("500K more this quarter unlocks the next price tier") · delivery calendar feed (ICS) · year-in-review · **pre-roll cost calculator** · **runnability scores** (machine-performance stats per lot — begins collecting from first delivered order) · one-click audit binder · client-side approval chains · spend analytics · FAQ/help section · guided first-login walkthrough · post-delivery **rating + testimonial capture** · former clients keep **read-only access forever (pay button stays)**
- **Client concierge AI** (v1, labeled "never orders or pays on its own")
- Deferred/cut: live 3D configurator (later), AI design studio (later), dead-stock exchange (**client-to-client trades free; sales to non-clients carry 10% platform fee** — v1.5), Volume Co-op "Costco for cones" (v1.5 flagship + trade-show story), guaranteed-supply contracts (v1.5), production slot booking + 4/20 radar (v1.5), The Cone Report (after 6 months of data), public instant-quote machine (next), chain-of-custody certificate, drawdown archive

## C. FACTORY PORTAL (/factory)
Named users, factory manages its own team. USD billing. Net terms after shipment. **Standing price list** (rate card) = instant run pricing. Client names ARE visible on runs (Rob chose simpler over anonymized).

- **Runs**: placed fully in-Hub; factory confirms; **48-hour unconfirmed flag** (timezone-fair); **promise-date revisions require Rob's acknowledgment**; rolling **60-day confirmed-order demand view**; **production packet** (everything for a run in one bundle + pre-generated QR lot labels); versioned spec sheets/recipes per SKU (full history kept); art files Hub-primary (outside allowed sometimes)
- **Quality**: **photo gate on every run** — shipping blocked until Rob approves; **AI photo pre-check** (v1) flags issues before Rob sees them; default factory-fault resolution: **free replacement run**; upstream material traceability (v1)
- **Shipping**: booking info, customs docs generated correct from the Hub (v1), docs auto-upload
- **Money**: factory statement of account with **interactive add-line builder** (factory adds lines: company, quantity, ship address, rate, fees — live running total); **admin sees a live mirror as an Excel-style grid** (numbered rows, gridlines, SUM row, XLSX export, discrepancy flags e.g. "KO's rate $0.0291 vs card $0.0284 = +$525 ⚠"); factory invoices logged by kind (goods/services/freight/other); shared ledger (v1); factory wire details stored in Hub (secured)
- **Account**: portal terms + existing docs stored; WhatsApp bridge (v1.5); capacity calendar (v1.5); material forecasting + promise-date assistant (v1.5); multi-factory bidding (future)
- **Receiving model (direct-ship)**: client receiver confirms arrival + photos; POD uploaded on SeshSure's side; same discipline applies if SeshSure ever warehouses

## D. PUBLIC SITE (seshsure.com) + SIGNUP
Site and Hub built together, one visual system. Public site: marketing + flagship story + referral page (Hub itself stays private per-user; affiliates tracked). Public forms in clean Hub look. Public **security page** (plain-English architecture for enterprise IT reviews).

**Signup flow (v4 preview approved):**
- Step 0: invite email from **rob@ (personal, not billing@)** — tracked, day-3 auto-reminder; **bare invite** (client fills everything; pre-fill supported when Rob has the data)
- Account creation → wizard (resumable server-side state machine; saves each step; ~8 min):
  1. **Company** — legal name*, DBA/brand, entity type, formation state, EIN (validated), phone, website, license # (**informational only — never gates**; expiry warns Rob, never blocks), lead source
  2. **Team** — multi-member with role chips: **client_admin** (orders + payments + team) / **client_ap** (invoices + payments only); add/remove live; each member gets own login
  3. **Shipping** — multi-address with label, full address, **receiver name + phone per address** (who the carrier calls), receiving notes (dock hours, liftgate); third-party receivers welcome
  4. **Agreements** — read + typed-name signature + **title** + authority checkbox; captured: name, title, user ID, **IP, user-agent, timestamp, agreement version**. Docs: Master Sales & Terms · ACH authorization (authorize-once master; **CCD** trading-partner form) · optional Credit Application + **Personal Guarantee** (only for net-terms seekers — the LLC-shield lesson). Executed PDF auto-emailed after signing. **Full re-papering: every existing client signs new terms before next order.** Agreement updates: clients accept new version at next order.
  5. **Payment method** — chooser: Portal pay/ACH (featured ⭐, self-selling copy) · Wire · Check (payable to Vido Manufacturing and Distribution Corp, 10940 S. Parker Rd, Suite 788, Parker, CO 80134) · Cash (numbered receipts). **Banking never blocks completion** — "finish later" path; the hard gate is at payment/production, not account creation.
  6. Done → guided walkthrough on first login
- Per-state resale certs tied to ship-to states (uncovered states flagged → tax applies at that state's rate)
- Optional: brand names upfront; AP ingest email (invoices file themselves)
- Gate logic: client.status invited → onboarding → active; **orders/production blocked below active; nothing ships without signed docs + cleared deposit — system-enforced**

---

# PART IV — MONEY RULES (all locked)

**Pricing display:** ALL prices per-cone (6.10¢/cone), never per-1,000. Sole exception: referral credit ($1 per 1,000 cones).

**Price structure:** default volume tiers + per-client overrides; **each client sees only their own numbers** (full catalog visible WITH their prices); resolution ladder: override → tier → ERROR (never guesses). Price changes: formal notice → auto-update on effective date. SKU dimensions: size + paper + crutch + pack format. Pack format is a SKU dimension; inventory counts individual units with case conversion. Coarse availability badge only (In Stock / Made to Order — never quantities). Printing included in SKU price; **no setup/plate fees ever** (absorbed); open Pantone — any color; rush orders quoted live case-by-case. Tubes: offered, never yet sold. **No minimum order quantities** (Rob approves everything anyway). Flagship peelable cone in catalog = **pre-order: click "interested" → partnership approval required** (launch-partner exclusivity concept).

**Known cost data:** EX price list = Rob's factory cost (provided as screenshots; xlsx pending). DAP all-in: **3.5¢/cone sea, 4.5¢/cone air** (seeded). Typical sell for standard blank: 6.0–6.5¢. Blended margin target: 2.5¢/cone. Contract volume ~15M/year; anchor ~1M/month.

**Floors:**
- **Flagship = 15¢ PROFIT per cone** (HARD): at approval, price − landed cost ≥ 15¢, where landed = latest factory rate for that product + sea DAP adder. Blocks with full math + minimum price shown. Blocks if no cost basis on file ("add its factory rate before quoting"). ~30¢ product at ~15¢ landed.
- Contract/blended 2.5¢ = advisory dashboard target, not enforced.

**Deposits:** 50% standard for everyone, manual exceptions per client/order; 0% allowed (production starts immediately); deposit dial at approval (order → client default → 50). Deposit invoice auto-sends on approval (no gap), due on receipt. **Unpaid deposit → order auto-expires day 14**, invoice voided with reason. Cancellation: **deposit forfeit at production start** (refundable before). Two invoices per order: deposit + balance (chosen as cleanest). Balance terms: **due on delivery — carrier POD auto-stamps the due date (+ Rob override)**. Weekend/holiday due dates stand (portal never closes). Overdue next day — **no grace period**.

**Cleared-funds law (method-agnostic):** `cleared_at` alone governs production starts, hold releases, and legal dismissals. ACH: settlement (next business day) + 2 business days no return. Check: bank shows **collected** funds (not merely deposited) — the Virgin Mary rule made global. Cash: on receipt with numbered receipt. Wire: on receipt confirmation.

**Payment methods (per client, admin-enabled set):** ACH portal-pay · wire · check · cash · card. Client switches preferred method self-serve within the enabled set (attempts outside it politely refused + logged). Currency: **USD locked globally**; Canadian clients see CAD courtesy estimate but always pay Rob's USD price (option A locked — Rob always gets his USD number); Canadian clients get wire instructions (no cross-border ACH).

**Partial payments:** allowed, minimum 25% of open balance (per-client toggle), server-enforced; payments capped at remaining balance (overpayment impossible); credits allowed on account, refund on request (refunds = ACH credit on the same rail, admin-initiated, or check).

**Interest:** 1.5%/month simple on overdue principal, auto-billed monthly on the 1st, idempotent per invoice-period; **frozen during honored payment plans**.

**Reminder ladder (neutral-corporate voice):** due → +3 → +7 → +14 → final +21. Rob CC'd/BCC'd on every reminder. Promise-to-pay dates pause the ladder (restart if missed). Disputes: flag exists; **clock keeps running until Rob manually pauses** (aligns with 7-day claims window). Final21 → **auto-hold** (per-client toggle; Rob can override). Structured claims module: 7-day window enforced, documentation required; micro-claim auto-credit for small claims (instant credit under threshold). Returned ACH debits: **no auto-retry — every return comes to Rob**; return auto-reopens invoice, flags client, notifies both sides, blocks paid status; NSF fee + ladder resume (worker planned).

**Invoice numbering:** new prefixed series SS-1xxx; numbers assigned **at send** (atomic, gap-free via claim_counter); drafts deletable; sent invoices **void & reissue** (never edit); void keeps its number with reason. Credit memos with reason codes.

**Fees to payer (standing rule, locked):** all processing fees pass to the payer; SeshSure's collected dollar arrives whole. Fee schedule table (method → flat + %) computed at payment time, disclosed BEFORE authorization, posted as separate line item. Card surcharge: **Colorado caps at 2% or actual cost (whichever lower)**; surcharge legality follows the CUSTOMER's state (CT/MA/ME/PR ban; debit never surchargeable); default set to 200 bps; per-client absorb_card_fee mercy toggle (absorbed cost surfaces in that client's margin). Level 2/3 B2B data submitted automatically (drops interchange toward ~2%).

---

# PART V — PAYMENT ARCHITECTURE (dual rail)

| Method | Rail | SeshSure cost |
|---|---|---|
| ACH | **First Citizens treasury** — direct NACHA origination (bank confirmed ACH origination YES); Hub builds bank-grade fixed-width NACHA files (94-char records, CCD, hash/debit/credit controls, block fill); file generation ONLY in service-role worker with vault access — never in web request contexts | ~$1 flat/item |
| Card | **Authorize.net** (via Rob's processor contact — EVP of wholesale payments, personal friend; payer-pays program with API; claimed "$20/month unlimited" and "not charging me anything") — rail BUILT: eCheck/card debits + refunds against stored CIM profiles (accountToken = customerProfileId\|paymentProfileId), sandbox/prod env switch, BOM-quirk handled | surcharge rides on payer |
| Wire | instructions on invoice | payer's bank fee |
| Check | payable-to + Parker address; camera-first recording (snap → match → numbered receipt) | a stamp |
| Cash | arranged directly | zero — numbered receipts always |

**The ACH flow:** one master authorization at onboarding → each payment individually approved by the client in the portal → server validates (session → drawer → invoice payable → amount ≤ remaining → 25% floor → verified bank → scheduled ≤ due) → writes payment + allocation + **append-only ach_authorization** (name, amount, invoice numbers, IP, UA, timestamp) → joins the day's batch → **Rob's one daily tap releases** (owner-only, amount-showing confirm) → NACHA file → settlement clock → cleared funds apply themselves. Manual batch first; **auto-submit daily at cutoff once proven** (Rob's chosen path). Bank statement descriptor: SESHSURE.

**NACHA originator obligations satisfied by design:** authorizations retained 2 years past revocation; return codes honored; debits never exceed authorized amounts.

**STATUS: payment-layer build is ON HOLD** pending written answers. Outstanding questions: processor — effective card rate with level 2/3 ("can you get it to 2%?"), compliant surcharge program with per-state handling, complete fee schedule (what "free"/"unlimited" excludes: gateway monthly, statement, PCI, batch, annual, early-termination), what happens when surcharge legally can't cover cost (CO 2% cap, debit, ban states), category approval IN WRITING (smoking accessories named on the application), contract term (month-to-month vs auto-renew), sandbox credentials. First Citizens treasury — ACH origination agreement, submission method (file upload vs API), cutoff times, per-item + monthly pricing, exposure limits, prefunding/reserve requirements. Negotiating ammunition: the $500/$20K QB fee receipt.

**Option ladder if pricing disappoints:** (1) direct treasury ACH ~$1/item — the default and floor; (2) bid processors competitively; (3) cards cost-neutral via surcharge regardless; (4) wire/check/cash run at full power with zero vendor. The software no longer cares who wins — rails are plugs.

---

# PART VI — CUSTOMS / COGS STRUCTURE (sensitive — handle carefully)

Factory invoices cones at **$0.01/unit for customs**; the remainder is paid as **services** (real, separate services the factory provides — Rob confirmed). Duties are calculated on declared goods value; services invoices are not presented to customs.

**Claude's flagged risks (on record):** undervaluation exposure under 19 USC 1592; importer of record bears liability; a diligence landmine at exit; services that are actually production-related (printing, packing, tooling) are dutiable as assists regardless of invoice labeling. **First-sale doctrine** noted as the legal alternative. Structure is defensible IF: services are genuinely non-production, a **written services agreement** exists (Claude to draft in the legal library), and the customs broker/attorney blesses it. Action items: Claude drafts the services agreement; Rob asks broker/attorney the one-liner.

**Hub design consequence:** customs declared value and TRUE COGS are separate database truths. `run_true_cogs` view = goods + allocated services + freight + duties + entry fees. The margin engine reads ONLY true COGS. Duty stack modeled: HTS 4813.10.0000, MFN/301/IEEPA bps, MPF (34.64 bps, min/max), HMF (12.5 bps). Duties tracked separately in landed cost to support ACE-portal tariff-refund claims (both entities' ACE accounts submitted; CBP ticket open; protest filings queued with the broker).

---

# PART VII — THE WORKERS (hourly cron artery, CRON_SECRET bearer-guarded, service role, jobs fail independently, health logged, all idempotent)

**Built (12):**
1. **settleAndClear** — submitted → settled next business day → **cleared = +2 business days no return** (weekends skipped)
2. **applyClearedToInvoices** — cleared money applies itself; statuses flip partially_paid/paid
3. **placeRuns** — deposit PAID (or zero-deposit / early-start override) → production run auto-created + linked; order → in_production
4. **expireStaleDeposits** — day-14 unpaid → order expired, invoice voided with reason
5. **reminderLadder** — the 5-step ladder; overdue auto-flip; promise-to-pay + dispute pauses; final21 auto-hold per toggle
6. **accrueInterest** — 1.5%/mo on the 1st, idempotency marker per invoice-period
7. **deliveryClock** — delivered shipments flip orders; **POD stamps balance due dates** (EasyPost webhook live path; this is the safety net)
8. **reorderRadar** — runway = stated weeks-of-supply − weeks elapsed (sharpens with reorder history); **amber ≤4 wk, red ≤3 wk** (Rob's thresholds); auto-email client + task for Rob; ONE alert per episode (open radar task suppresses)
9. **expireQuotes** — 7-day expiry (per-quote override allowed)
10. **complianceAlerts** — docket horizons 90/60/30/7 once each; **overdue screams daily** until completed
11. **flushNotifications** — the sender: resolves recipient (AP contact for invoices → any contact fallback; purchasing for radar; Rob for compliance); failures record their reason; provider ID stored
12. **dailyBrief** — 8:00 AM MT (Rob's time), subject carries the numbers ("☀️ Brief — $84,120 out · 2 overdue · 5 in queue"); body: AR, overdue, money in flight, task queue, open runs; idempotent per day

**Planned roster (approved):** monthly statements (1st — client + factory) · send-time queue (client comms held for 9 AM client-local) · win-back autopilot (2× reorder gap) · run watchdog (48h unconfirmed + promise slips → exceptions) · document expiry (resale certs, W-8BEN-E, licenses → tasks) · task escalation (louder over time) · returns/NSF processor (return codes → payment returned + fee + ladder resume) · standing-order generator · statement generator.

---

# PART VIII — EMAIL SYSTEM

Sender: billing@seshsure.com (invites from rob@ personally). Every message: CAN-SPAM footer (full entity name, Parker address, why-receiving, human-reads-everything line), reply-to rob@, **Rob BCC'd by default on all outbound**. Templates in one registry (Rob-editable later): invoice.sent · reminder.due ("friendly note") · plus3 ("quick nudge — if something's off, hit reply") · plus7 ("interest accruing — or tell us a date") · plus14 ("action needed") · final21 ("FINAL NOTICE — orders paused, formal collection next, paying now stops everything") · radar.nudge.amber/red (client's own runway number, reorder CTA) · compliance.alert · payment.receipt (receipt + full open-invoice list per Rob's spec). Voice: neutral-corporate throughout (Rob's choice), escalating firmness. Reminders invite dispute-by-reply BEFORE escalating. Notification prefs: **email for everything, real-time always** (Rob's choice). Client notification center in-portal; SMS is P2 (email-only at launch). Invoice-view notifications to Rob on every view.

---

# PART IX — SECURITY, EVIDENCE, ENTERPRISE CHROME

- 167 RLS policies deny-by-default (see Part II)
- Append-only: signatures, ach_authorizations, invoice_views, activity_log, payment_receipts
- Middleware role-routing every request (owner/staff→/admin, client_*→/portal, factory_*→/factory); inactive accounts blocked; wrong doors redirect; RLS holds even if middleware fails
- Bank data: Supabase Vault encrypted, masked in UI (••••4821), never logged, decrypted only in service-role workers; NACHA generation never in request context
- Auth: strong passwords; email OTP 2FA; magic link for AP; **no re-verification at money buttons** (logged in is logged in — Rob's choice); rate limiting; session audit on every payment action
- Workers act above RLS, below the audit log
- Data isolation: per-client per-user data lives in their own partitioned spots (Rob's requirement)
- Backups: nightly + point-in-time recovery + weekly independent emailed export; hub status page
- Emergency/continuity: business continuity template (written); emergency admin access path
- **Enterprise chrome standards:** portal footers (© Vido Manufacturing and Distribution Corp d/b/a SeshSure · Parker address · Terms · Privacy · support) · Terms/Privacy accepted at first login, recorded as signatures · invoice blocks (remit-to per method, terms reference, EIN, page X/Y, tagline **"Puff. Peel. Pass.™" on everything — brand it all**) · PDF document control (doc ID, version, generated-at, confidentiality on internal exports) · public security page · one entities record sources all legal identity · admin footer "INTERNAL SYSTEM · ALL ACTIVITY LOGGED"
- SOP binder (from one source, web + PDF, **enterprise-level detail**): client onboarding · order-to-cash · payment batching & returns · collections & escalation to court · production runs & factory management · receiving claims & disputes · month-end close & reconciliation · prospect handling — each with version/owner/review-date headers
- Contact firewall: supplier/factory names NEVER client-facing; client and factory bridged only through the Hub; non-circumvention in both agreements; relay threads carry no identities

---

# PART X — AI LAYER

**v1 (adds ~2 weeks, ~$30–100/mo usage): read-and-draft ONLY.** Hub AI on Command ("answers from your data · drafts only") · client concierge ("never orders or pays on its own") · freight agent ("suggest mode — recommends, you decide") · AI photo pre-check on QC · AI-drafted collection/reply drafts queued for approval · deal simulator. Every logged action is written in a uniform shape (actor/action/before/after) — deliberately, as the substrate the AI reads.
**Phase 2 (needs data history):** predictive credit, rate timing, pre-positioning, anomaly watchdog, voice-to-action, AI replies auto-send.

---

# PART XI — CURRENT BUILD STATUS

**Real code, compiling, committed:** money library (BigInt, conesToCents, formatUSD/formatPerCone, pctOf) · Supabase server/browser clients · roles + middleware · login w/ email-OTP 2FA + magic link + auth callback · onboarding state machine + validated API (zod: EIN regex, emails) + full signup wizard · portal layout + enterprise footer · invoices list + detail (evidence-writing) + PayPanel (chips, floor, method-aware) · Money page (method switching + micro-deposit verify) · pay endpoint (all guardrails + append-only authorization + rail handoff) · rail socket (PaymentRail interface) + NachaRail + AuthorizeNetRail + per-method railFor() · pricing ladder · admin layout + live Command + Batches + ReleaseButton + owner-only release endpoint · NACHA file builder · invoice library (gap-free numbering, totals, deposit split) · order approval endpoint (profit floor w/ landed-cost math, credit ceiling w/ live exposure, deposit dial, invoice birth, 14-day expiry) · 12 workers + hourly cron · email engine + full template registry · migrations 0001–0010 (sqlglot-validated) · .env.example + vercel.json cron + GO-LIVE.md.

**Approved visual reference:** seshsure-hub-complete.jsx (v4 preview) — all tabs: You (Command/Clients/Freight/Legal/Pipeline/Control), Client, Factory, Signup, Site; calm-by-default collapsible sections; ~150-feature long tail builds from these established patterns without further demo screens.

**Build order remaining:** factory portal pages → admin order-approval UI (margin display before the tap) → runs slice (sequential run numbering replaces provisional) → freight slice (bids, tracking, exceptions) → collections/legal packet generation → statements → remaining workers → AI wiring → public site → invoice PDF design (awaits logo) → SOP binder → QB import + penny-perfect reconciliation.

**Assembly principles:** vertical slices, not layers · money first in sandbox · Rob's QB history is the test data (import doubles as reconciliation proof → QB cutover) · everything behind per-client switches · rollout: dry run → Rob pilots as a client → anchors → everyone · **QuickBooks dies only after the import reconciles to the penny.**

---

# PART XII — PENDING INPUTS (the gates)

1. **Accounts** (GO-LIVE.md, ~45 min, ~$53/mo): GitHub org, Supabase Pro $25, Vercel Pro $20, Resend, EasyPost, 1Password $8 — all under rob@seshsure.com, 2FA everywhere, passwords in a "SeshSure Hub" vault → then Claude deploys same day (push, envs, migrations, seeds, smoke test) → first 8 AM brief next morning. DNS: hub.seshsure.com CNAME to Vercel + Resend's 3 records (SPF/DKIM).
2. **Processor answers in writing** (list in Part V) + sandbox credentials.
3. **First Citizens treasury** ACH origination details (list in Part V) → activates direct rail (ODFI routing + company ID envs).
4. **QuickBooks CSVs** — QBO → Reports → "Invoice List" (all dates) → Export Excel; same for "Transaction List by Customer" and "Customer Contact List" → 3 files → import → penny reconciliation → QB retired.
5. **Logo/vector files** (Rob has finals) → invoice PDF design pass + Hub polish.
6. **Factory rate card as xlsx** (screenshots exist; xlsx avoids transcription errors) → seeds pricing + landed-cost bases (the flagship floor needs a cost basis on file to quote).
7. Earlier task list: attorney hour (services agreement + surcharge questions), GL insurance quote (none currently — vendor packet needs the cert), W-9 prep, broker blessing on the services/customs structure, email/DNS host identification.

---

# PART XIII — KEY CONTEXT & CROSS-REFERENCES

- Entity: Vido Manufacturing and Distribution Corp (CO), d/b/a SeshSure, 10940 S. Parker Rd, Suite 788, Parker, CO 80134. Rob = Founder & CEO (title on all documents). Sole issuing entity (multi-entity schema-ready if the Holdings/Manufacturing trademark cleanup requires it).
- Litigation lessons baked in: cleared-funds-before-dismissal (Virgin Mary), stipulation/payment-plan tracking with acceleration (Slow Burn), personal guarantees for net terms, evidence-by-default, demand +30 / file +45, any-amount-always-file, Douglas County venue + Colorado law in all agreements.
- Exit framing: five-year $100M target; the Hub's data room export, KPI dashboards (10M units/mo line, $10M annual), margin engine, and clean books all exist to serve diligence.
- Working-style notes: Rob is terse; wants decisions, not menus; corrects immediately and expects clean rebuilds; standing order — proactively find improvements while building; when Rob says stop, stop; payment build resumes only on written answers.

---

# PART XIV — DISPUTES MODULE (approved 2026-07-13)

**A Disputes tab in the Client Portal** ("Report an issue" client-facing; dispute internally) that creates one database row with three views: client, factory (attached to the linked production run), and Rob's Admin queue. Contact firewall applies in full: the factory has NO reply channel to the client; every factory response routes to Rob who relays.

**Filing:** starts from the order or QR lot-label scan (prefills order/lot/SKU/run). Auto-captured: SS-D gap-free number, server timestamp, client, user, linked order/invoice/lot/run, days-since-delivery from POD. **7-day window: outside-window claims still submit, flagged "requires owner review" — Rob decides (ruled: flag-for-review, not hard-reject).** Fields: issue types (multi-select: tears · burn issues · paper defects · crutch problems · size out of spec · glue/seam · discoloration · print defect · machine runnability · short count · transit damage · moisture · foreign material · odor · other), description, **photos required (min 1; case-label photo for short counts; EXIF retained)**, quantity affected + % inspected, how discovered, production-stopped urgency toggle, desired resolution, batch behavior (whole shipment / one case / scattered).

**Client sees:** instant acknowledgment + quarantine instruction (hold product as-is), coarse status ladder (Submitted → Under review → Resolution offered → Resolved), all communication in-thread.

**Factory sees:** claim attached to their run in a Quality Claims queue with the QC-gate photos from that run auto-attached for comparison; response options (to ROB only): accept fault (default = free replacement run) · dispute with evidence · request more info. 48-hour response flag; claim history feeds their quality scorecard.

**Rob's resolution desk:** side-by-side evidence screen; one-tap resolutions (credit memo · replacement run at $0 if factory fault · partial credit · deny with reason · micro-claim auto-credit confirm). **Root-cause required to close:** factory fault · freight damage · client-side · no fault found · goodwill — drives who eats the cost. Freight damage routes to the Freight Desk exception flow, not the factory. **Money rules unchanged:** ladder pauses only manually; resolution credits per cleared-funds law. Full append-only dispute timeline — court-packet-ready.

**Approved additions (all eight):** lot-wide blast-radius check (confirmed factory fault → auto-list every client on that lot + proactive heads-up tasks) · **SLA clocks — INTERNAL ONLY, never client-facing promises** (24h acknowledge, 5-day resolution, 48h urgent; overdue screams in queue) · sample return/retention protocol (prepaid label request; retain 30 days) · defect analytics (per lot/SKU/factory/month; feeds runnability + exit diligence) · recurrence detection (same issue, same SKU, 2+ clients, 30 days → tighten that SKU's photo-gate criteria) · dispute → knowledge loop (root causes feed the AI photo pre-check) · client-facing outcome summary PDF per resolved dispute · abuse guardrail (dispute frequency feeds client health grade).

**Data model:** disputes · dispute_media (append-only) · dispute_events (append-only timeline) · dispute_messages (factory messages never client-visible and vice versa without Rob's relay — RLS-enforced both layers). Builds alongside the runs slice; reuses claim_counter, credit memos, notification engine, QC photo storage, action queue.

---

# PART XV — MULTI-FACTORY OPERATIONS (approved 2026-07-13)

Architecture was built plural (factories table, factory_id on every run, per-factory RLS walls, per-factory rate cards). Multi-factory adds:

**Routing = Rob's tap (v1 rule).** At order approval, factories display side-by-side: their rate for that SKU, current load (60-day view), quality score, promise reliability — Rob picks. The flagship 15¢ profit floor computes against the CHOSEN factory's landed cost, so routing visibly changes margin at the moment of choice. Rules-based auto-routing = phase-2 toggle after history exists.

**The Run Board (sealed-bid marketplace).** Orders Rob chooses to broadcast post to a board all factories see: full specs, quantity, target window — factories respond with price + promise date + capacity, or decline with reason (declines = capacity intelligence). Rules: **sealed bids** (factories never see each other's numbers or existence — firewall extends factory-to-factory) · **client anonymized on the board** (name attaches after award) · **the flagship NEVER posts to the board** (direct assignment to flagship-gated factories only) · award screen shows bids beside quality + reliability scores (value, not just price). **Board is a tool, not the default:** primary factory gets assigned work at the standing rate card; the board handles overflow, new SKUs, price discovery, quarterly market checks. Assign-or-post is Rob's choice per order.

**Per-factory quality scorecards — reliability doctrine:**
1. Scores computed, never typed — derived solely from append-only machine-recorded events (promise vs. actual ship timestamps; Rob-ruled disputes ÷ units delivered); recomputable from raw events anytime (diligence-grade)
2. Only Rob's root-cause ruling counts against a factory (serial-disputing clients can't poison factory records — the abuse guardrail catches them client-side)
3. Every score clickable to its evidence (runs, disputes, photos)
4. Sample-size honesty: no score until ~10 runs ("collecting — 4 runs"); volume always displayed beside percentage
5. Recency-weighted (trailing 12 months); catastrophic events flagged separately from chronic drip
6. **Factories see their own scorecard** (only theirs, with breakdown) — transparency as self-correcting incentive

**Factory onboarding playbook (wizard, like client signup):** portal terms + NDA/non-circumvention e-signed in-portal · banking details vaulted · **payment terms per factory captured here** (net terms, early-pay discount, currency — feeds per-factory cash forecasting and the deal simulator: "what does shifting 30% of volume to Factory B do to my cash cycle?") · rate card uploaded · spec sheets acknowledged version-by-version · **qualification run** (small paid batch, scored like any run) before board eligibility.

**Supporting features:** compliance drawer per factory (certs, food-contact declarations, W-8BEN-E, insurance — document-expiry worker watches factory papers too) · **concentration risk on the goals dashboard** (% of trailing-90-day volume on top factory) · geographic/tariff lens (factories tagged by country; award screen shows landed cost including each origin's duty stack — tariff changes reprice options overnight, visibly) · **flagship second-source file** (quiet checklist: which factory could qualify next, what they'd need — turns "factory went dark" into a 60-day playbook) · **flagship gate** (per-factory flag controlling who may ever produce the patented cone — recipes and peel construction never propagate to commodity factories; Hub-enforced) · quarterly factory review folded into the month-end ritual (one page per factory: volume, quality, reliability, pricing vs. board bids).
