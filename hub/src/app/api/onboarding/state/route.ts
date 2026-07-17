import { NextResponse } from "next/server";
import { getOnboardingState } from "@/lib/onboarding";
export async function GET() {
  const s = await getOnboardingState();
  return s ? NextResponse.json(s) : NextResponse.json({ error: "none" }, { status: 404 });
}
