// ————— PACKING PRESETS — save carton specs once, reuse forever —————
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET() {
  const sb = supabaseServer();
  const { data } = await sb.from("packing_presets").select("*").order("created_at", { ascending: false });
  return NextResponse.json({ presets: data ?? [] });
}

const Body = z.object({
  name: z.string().min(2),
  cartonLCm: z.number().positive(), cartonWCm: z.number().positive(), cartonHCm: z.number().positive(),
  unitsPerCarton: z.number().int().positive(),
  cartonKg: z.number().positive().optional(),
});

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const b = parsed.data;
  await sb.from("packing_presets").insert({
    name: b.name, carton_l_cm: b.cartonLCm, carton_w_cm: b.cartonWCm, carton_h_cm: b.cartonHCm,
    units_per_carton: b.unitsPerCarton, carton_kg: b.cartonKg ?? null,
  });
  return NextResponse.json({ ok: true });
}
