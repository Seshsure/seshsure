// Daily worker artery — Vercel Cron hits this; CRON_SECRET guards it.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { settleAndClear, applyClearedToInvoices, placeRuns, expireStaleDeposits, reminderLadder, accrueInterest } from "@/lib/workers";
import { deliveryClock, reorderRadar, expireQuotes, complianceAlerts } from "@/lib/workers2";
import { flushNotifications, dailyBrief } from "@/lib/workers3";
import { runWatchdog, documentExpiry, taskEscalation, returnsProcessor, monthlyStatements, planWatchdog, freightExceptions, winBack, sampleFollowups, referralCredits, demandLetterDrafts, bidChase, autoRfq } from "@/lib/workers4";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const jobs = [settleAndClear, applyClearedToInvoices, placeRuns, deliveryClock, expireStaleDeposits,
    reminderLadder, accrueInterest, reorderRadar, expireQuotes, complianceAlerts,
    runWatchdog, documentExpiry, taskEscalation, returnsProcessor, monthlyStatements,
    planWatchdog, freightExceptions, winBack, sampleFollowups, referralCredits, demandLetterDrafts, bidChase, autoRfq,
    flushNotifications, dailyBrief];
  const results: Record<string, string> = {};
  for (const job of jobs) {
    try { await job(sb); results[job.name] = "ok"; }
    catch (e) { results[job.name] = e instanceof Error ? e.message : "failed"; }
  }
  await sb.from("activity_log").insert({ actor_label: "system", action: "cron.daily.completed", after: results });
  return NextResponse.json(results);
}
