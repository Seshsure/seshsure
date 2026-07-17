# SOP 01 — DAILY BATCH RELEASE
**Trigger:** Command tile shows BATCH READY > $0 (authorized + scheduled-due payments).
**Steps:** 1) Open /admin/batches. 2) Scan the debit list — names and amounts should match expectations; anything surprising, investigate before releasing. 3) Tap Release → CONFIRM (two taps by design). 4) Deliver the NACHA file to First Citizens per treasury procedure before the daily cutoff.
**Done when:** payments show SUBMITTED; batch logged with your name.
**If it goes wrong:** 409 "batch changed" = a payment landed while you looked; refresh and re-confirm. Never release a total you haven't read aloud once.
