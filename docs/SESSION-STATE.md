# SESSION STATE — updated 2026-08-22
Single source of truth for cross-chat handoff. Any Claude session: read this after cloning.

## JUST SHIPPED (this session)
- **Live SOA** (migs 0043/0044, commits → 2ae55f7): mutual factory statement.
  Opening anchor $279,521.60 @ 2026-08-17 (SOA-2026-08-17, FACTORY-01).
  Factory /factory/soa: SUBMIT invoice (doc mandatory) + CONFIRM/DISPUTE per line.
  Owner /admin/factory-ledger: add lines, APPROVE/REJECT queue, entity chips
  (ST Global Packs = goods, Solitude Flame = services). Sign owned by API.
  Approved charges auto-tag cogs_category (goods/services/freight) for the
  landed-cost engine. Duties/FET/broker deliberately NOT in factory SOA.
  Factory RLS read-only; all actions via /api/soa (column-leak policy was
  caught and dropped).

## TOKENS (rotated 2026-08-22)
- GitHub: fresh classic token minted 8/22 (90-day) — lives in chat with Rob,
  NEVER in this repo (push protection rightly blocked the first attempt).
- Vercel + Supabase: STILL JULY BATCH — expiring soon, Rob to rotate.

## STANDING STATE
- EMAILS_ENABLED=false. Two-layer: auth/invites/approvals always flow;
  business mail (invoices/dunning/receipts/radar/statements) suppressed.
  15 legacy invoices dunning_paused (Slow Burn litigation, Virgin Mary
  payment plan, Grizzly, KO, ConeHead). Aug statements skipped via
  activity_log marker. INV-TEST-100 deliberately live.
- Supabase Pro active, daily backups confirmed. PITR held until first
  paying client. Storage buckets still unbacked (queued).
- ship.sh at repo root: tsc+lint+build must pass before push. USE IT.

## BUILD QUEUE (order)
1. Landed-cost engine (per-shipment: SOA charges + duties + FET + broker
   + freight → ¢/cone vs 15¢ floor)
2. Reconciliation (FCB statement import → matcher → exceptions page)
3. Storage backups + evidence photos (forwarder POD, factory QC)
4. CI money tests (freeze NACHA + registry proofs)
5. Resale-cert onboarding step (sales-tax exposure on smoke shops)
6. Arcade Phase 2 (needs Word Pool v2 + Squarespace NS ticket)

## ROB QUEUE
Catalog dump (last data gate) · account walks (funnel/client/factory/
arcade/bank-add/SOA) · Braj + Kerry + Luminer invites · Amber/FCB reply
(test file sent? 3 questions: company ID prefix, SFTP creds, entry/addenda
count) · attorney package · CPA (+ TTB permit + state OTP survey) ·
Vercel/Supabase token rotation.
