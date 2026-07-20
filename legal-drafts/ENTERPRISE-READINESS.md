# SESHSURE — ENTERPRISE READINESS AUDIT
*Prepared 2026-07-20 · Status-marked: ✅ done · 🟡 in motion · 🔴 needs Rob/attorney*

## 1 · LEGAL STACK
- ✅ **Seven agreement documents versioned in-platform** with append-only e-sign evidence (name, title, timestamp, IP, device): Master Sales (no-novation), Credit/PG, ACH Auth, Hub TOU, Factory NDA/IP, Non-Circumvention, Supply Terms.
- ✅ **Cross-border enforceability architecture (v2 factory docs):** Colorado law + CISG opt-out; **AAA arbitration seated in Denver under the New York Convention** — the decisive choice, because India does NOT enforce US court money judgments (US is not a "reciprocating territory" under Indian CPC §44A) but DOES enforce NY-Convention arbitral awards; injunctive-relief carve-out for IP emergencies; courier/email service-of-process consent (bypasses year-long Hague service); ESIGN/UETA + Indian IT Act 2000 e-signature clause; prevailing-party fees; blue-pencil severability.
- ✅ **India §27 restraint-of-trade mitigation:** Indian law voids post-term non-competes; v2 therefore frames all restrictions as IP/trade-secret/confidentiality protections (which Indian courts DO enforce) — flagged for counsel to pressure-test.
- 🔴 **Attorney review** — all seven docs carry the draft banner. Highest priority: NDA/IP (the patent moat's paper armor). Recommend CO counsel + a one-hour consult with Indian counsel on §27 framing and award-enforcement posture.
- 🔴 **Trademark entity mismatch** (Serial 99567102 held by Vido Holdings LLC; operating co is Vido Manufacturing) — must resolve before Statement of Use (~Feb 2027). Assignment or license-and-record; attorney task.
- 🔴 **Registered agent for service** (optional hardening): require factory to designate a US agent for service of process, or accept the courier/email consent as drafted.

## 2 · REGULATORY & CLAIMS
- ✅ Compliance-file discipline in memory: Swiss Ordinance/EuPIA ink stack, laminate encapsulation strategy, migration testing chain.
- 🟡 **Claims substantiation file** — hygiene claims need the completed Flint declaration (NDA-gated), Henkel PS 3212 package, Polyplex SARALAM declarations. This file IS the enterprise sales asset.
- 🔴 **California Prop 65 review** before CA brand deals (STIIIZY, Raw Garden, Cookies are CA) — paper + adhesive stack likely clean, but the warning-or-analysis decision needs making once, in writing.
- ✅ Customs posture: HTS 4813.10.0000 consistency, ACE portal, tariff-refund rails.

## 3 · FINANCE & TAX
- ✅ Penny-reconciled books in-platform; BigInt money math; append-only audit trail; cleared-funds doctrine; CO 2% surcharge cap enforcement.
- 🔴 **Collect W-8BEN-E from the factory** before first hub-era payment — establishes foreign status/treaty position for US withholding purposes. (Add to onboarding doc list — one checkbox away.)
- 🟡 Payment rails: First Citizens ACH (Alicia) + processor agreement (Lee) — both awaiting written terms; Level 2/3 interchange data on the build list (0.5–1% card savings).
- ✅ Exit-tax architecture already in play per plan (QSBS stacking, structure decisions) — attorney/CPA-led, on your calendar not mine.

## 4 · PLATFORM SECURITY (what an enterprise buyer's diligence sees)
- ✅ 218 RLS policies — every table walled; storage foldered by client/factory ID; role-confined areas; owner-only mutations audited with before/after.
- ✅ 2FA enforced at middleware (AMR check — password alone is rejected); append-only activity + signatures tables (trigger-enforced).
- ✅ Wire-change voice-verification freeze (supplier-impersonation fraud, pre-blocked).
- ✅ Email master kill-switch; interest frozen-by-default; server-side pricing.
- 🔴 **Supabase Pro upgrade ($25/mo)** — unlocks point-in-time recovery + daily backups. Do before first client login. This is the single cheapest enterprise checkbox on the list.
- 🟡 Key hygiene: publishable/secret split done; rotate the GitHub PAT and Supabase access token after build phase ends.

## 5 · INSURANCE (the gap the hub can't code away)
- 🔴 **General liability + product liability** — you sell a lip-contact consumer product component; a brand deal's vendor form will demand $1–2M GL/PL with additional-insured endorsement. Get quoted now (cannabis-adjacent-friendly broker), not the week High Tide's procurement asks.
- 🔴 **Marine cargo insurance** on ocean shipments (FOB = your risk from port of origin).
- 🔴 Cyber liability — cheap at your size, expected in enterprise vendor reviews.

## 6 · CONTINUITY
- ✅ Second-source architecture (multi-factory Run Board, sealed bids, scorecards) — the answer to "what if your factory disappears."
- ✅ Code + data reset-proof (GitHub, managed Postgres, tarball ritual).
- 🟡 Documented recovery runbook — exists in transcripts; formalize one page when convenient.

## THE SHORT LIST (in order)
1. Attorney: seven docs + TM entity fix (one engagement)
2. Supabase Pro (5 minutes)
3. Insurance quotes: GL/PL + marine cargo (one broker call)
4. W-8BEN-E added to factory onboarding (built on request)
5. Prop 65 memo before CA brand outreach
