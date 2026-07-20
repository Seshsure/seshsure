// ————— DEPLOY MARKER — which commit is actually serving? —————
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({
    ok: true,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "unknown",
    deployed: process.env.VERCEL_DEPLOYMENT_ID ?? null,
  });
}
