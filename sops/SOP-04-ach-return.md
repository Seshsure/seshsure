# SOP 04 — ACH RETURN
**Trigger:** 🔴 ACH RETURNED task (invoice already reopened, client auto-flagged WATCH; nothing retries automatically — every next step is yours).
**Steps:** 1) Read the return code. R01 (insufficient funds) → call the client, get a date, consider requiring wire/certified for the retry. R02/R03/R04 (account closed/invalid) → bank details are dead; require new verified account before any retry. R05/R07/R10 (unauthorized/revoked) → STOP; this is a dispute of the authorization itself — pull the ACH authorization evidence, do not re-debit, treat as potential legal matter.
2) Log the call. 3) Decide: retry (manually, once, with consent), convert to wire/check, or escalate to demand.
**Never:** auto-retry; re-debit after an unauthorized-code return.
