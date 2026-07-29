# SESHSURE HUB — MASTER BUILD LIST
*Full audit 2026-07-28 · supersedes ENTERPRISE-READINESS.md priorities · reprioritize as items close*

## AUDIT SNAPSHOT (verified today, not aspirational)
- 36 pages · 50 API routes · 25 workers, ALL wired into hourly cron with per-job error isolation
- 103 tables · 230 RLS policies · ZERO unprotected tables (verified against pg_policies)
- CI green on every push (typecheck + lint) · migrations 0001–0031 synced to prod history
- Email: domain verified, branded banner system live, CAN-SPAM footers (transactional/marketing split), master kill-switch OFF pending first client
- Freight: factory capture (AWB check-digit validated) → auto-RFQ → bid → award; shipped-blind exception strip live
- Test client account live (Peak Test Brands) for owner walkthroughs

## P0 — BEFORE ANY REAL CLIENT LOGS IN
1. **Supabase Pro + PITR** — pitr_enabled:false, backups:[] as of audit. No restore point exists. ($25/mo — Rob, on new debit card arrival)
2. **Attorney engagement** — seven agreement docs carry draft banners; the MSA every client signs is unreviewed. TM entity fix same engagement.
3. **Verify NEXT_PUBLIC_SUPABASE_* env values are real** — stored sensitive-type so unpullable; three other "sensitive" vars turned out to be literal placeholders. PROOF: owner login walk on hub.seshsure.com. If login works, close this.
4. **Error monitoring (Sentry free tier)** — currently a 2am 500 is invisible. One commit. (Claude)
5. **Public /terms + /privacy pages** — surface Hub TOU, draft privacy policy for attorney pile. Vendor reviews and CCPA expect them. (Claude drafts, attorney blesses)

## P1 — OPERATING GAPS (money touching, this month)
6. **Forwarders table is EMPTY** — the RFQ flow can't invite anyone. Enter NTG/Kerry (+ 1–2 competitors for real sealed bids). 5-min data entry, owner or Claude with details.
7. **Award → shipment link** — awarding a bid pre-creates the shipment row the factory's AWB attaches to. Closes quote→landed. (Claude, next build)
8. **Supplier PO ledger** — PO/invoice/AWB/payment matching for the factory side; kills duplicate-invoice and untracked-PO classes permanently. ($310K balance deserves a ledger, not a spreadsheet.) (Claude)
9. **Landed-cost actuals** — freight award + duties + goods cost per run → real ¢/cone vs 15¢ floor, auto-flagged. Data exists across shipment_costs/true_cogs; needs the join + surface. (Claude)
10. **W-8BEN-E checkbox in factory onboarding** — foreign-status paper before first hub-era payment. (Claude, small)
11. **Wholesale Payments follow-up** — merchant approval is the gate on card rail. (Rob: chase Lee for written terms)
12. **Marine cargo insurance for the boat shipment** — if it's on the water uninsured, call Kerry TODAY for per-shipment cover. Standing policy before ocean cadence. (Rob)

## P2 — ENTERPRISE POLISH (before anchor-brand diligence)
13. **Rate limiting on public endpoints** (/api/public/*, auth) — with the payments security pass
14. **Paid RLS/payments security review** — external eyes on the money surfaces, timed at payment-resume
15. **Uptime monitoring** — free pinger on hub.seshsure.com + /api/public/health
16. **GL/PL + cyber insurance quotes** — before any brand vendor form asks (Rob: one broker call)
17. **Prop 65 memo** — before CA brand outreach (attorney)
18. **Recovery runbook page** — formalize the reset ritual from transcripts (Claude, one doc)
19. **Squarespace NS flip lands** — kills Doteasy dependency; then Google Workspace DKIM add (Rob: ticket nudge cadence)

## P3 — SCALE FEATURES (build when triggered, not before)
20. **Inventory/allocation** — trigger: sustained volume or first allocation-drop campaign
21. **Licensing/royalty module** — trigger: Victor or first wrap-license signature
22. **Compliance vault per SKU** — trigger: first anchor-brand QA request (assembles Flint/Ester/Polyplex/Henkel packages; sales weapon)
23. **EasyPost activation** — trigger: first domestic parcel program (secret already staged in Vercel)
24. **Ocean milestone API (Terminal49-class)** — trigger: ocean cadence >2 containers/mo
25. **Level 2/3 interchange data** — trigger: card rail live (0.5–1% savings)

## STANDING RULES (never regress)
- All outbound email legally compliant (CAN-SPAM footers, unsubscribe on marketing-class, no deceptive subjects) — in memory
- Legibility beats decoration
- Token rotation monthly (Vercel, GitHub, Supabase) — next: ~2026-08-28
- Test-client walk before any feature ships to real clients
- Supplier names/origin/costs never in client-visible surfaces
