// ————— LANE TARGET — owner sets "what it should be" —————
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({ laneKey: z.string().min(3), targetUsd: z.number().positive(), note: z.string().max(200).optional() });

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if (prof?.role !== "owner") return NextResponse.json({ error: "owner only" }, { status: 403 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const b = parsed.data;
  await sb.from("lane_targets").upsert({
    lane_key: b.laneKey, target_cents: Math.round(b.targetUsd * 100), note: b.note ?? null, set_by: user.id,
    updated_at: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true });
}
