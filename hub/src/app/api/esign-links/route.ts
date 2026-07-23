// ————— MINT A SIGNING LINK — owner only —————
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({
  docKey: z.string().min(2),
  email: z.string().email(),
  company: z.string().optional(),
  clientId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if (prof?.role !== "owner") return NextResponse.json({ error: "owner only" }, { status: 403 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const b = parsed.data;
  const { data: link, error } = await sb.from("esign_links").insert({
    doc_key: b.docKey, recipient_email: b.email, recipient_company: b.company ?? null,
    client_id: b.clientId ?? null, created_by: user.id,
  }).select("token").single();
  if (error || !link) return NextResponse.json({ error: error?.message }, { status: 500 });
  return NextResponse.json({ ok: true, url: `${process.env.HUB_URL ?? "https://hub.seshsure.com"}/sign/${link.token}` });
}
