// ————— IN-HOUSE ERROR REPORTER — own rails, no APM vendor —————
// Server-side only (workers + API routes). Writes to error_log (internal
// RLS) and alerts the owner through the existing verified Resend rail,
// throttled to one email per error signature per hour so a crash loop
// produces one alert, not a storm. Detail is truncated and never includes
// environment contents.
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendTemplate } from "@/lib/email";
import crypto from "crypto";

const THROTTLE_MS = 60 * 60 * 1000;
const OWNER = "rob@seshsure.com";

export async function reportError(sb: SupabaseClient, source: string, err: unknown) {
  try {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 300);
    const detail = (err instanceof Error && err.stack ? err.stack : "").slice(0, 2000);
    const signature = source + ":" + crypto.createHash("sha256").update(message).digest("hex").slice(0, 12);

    // Throttle check BEFORE insert: has this signature alerted in the window?
    const since = new Date(Date.now() - THROTTLE_MS).toISOString();
    const { data: recent } = await sb.from("error_log")
      .select("id").eq("signature", signature).gte("created_at", since)
      .not("alerted_at", "is", null).limit(1);
    const shouldAlert = !recent?.length;

    await sb.from("error_log").insert({
      source, signature, message, detail,
      alerted_at: shouldAlert ? new Date().toISOString() : null,
    });

    if (shouldAlert) {
      await sendTemplate({
        to: OWNER, templateKey: "system.error",
        vars: { source, message, time: new Date().toISOString() },
        systemOverride: true, bccOwner: false,
      });
    }
  } catch {
    // The reporter must never take down the thing it watches.
    console.error(`[reportError failed] ${source}`);
  }
}
