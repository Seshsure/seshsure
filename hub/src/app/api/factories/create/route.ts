// ————— NEW FACTORY — owner only —————
// Creates a neutral designation (FACTORY-NN). The factory supplies its own
// name and details through onboarding; nothing is assumed here.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({ inviteEmail: z.string().email().optional() });

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (prof?.role !== "owner") return NextResponse.json({ error: "owner only" }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const { count } = await sb.from("factories").select("id", { count: "exact", head: true });
  const designation = `FACTORY-${String((count ?? 0) + 1).padStart(2, "0")}`;

  const { data: factory, error } = await sb.from("factories")
    .insert({ name: designation, is_active: true }).select("id, name").single();
  if (error || !factory) return NextResponse.json({ error: error?.message }, { status: 500 });

  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: prof.full_name ?? "owner",
    action: "factory.created", entity_table: "factories", entity_id: factory.id, after: { designation },
  });

  let inviteMsg = "";
  if (parsed.data.inviteEmail) {
    const r = await fetch(new URL("/api/factories/invite", req.url), {
      method: "POST", headers: { "content-type": "application/json", cookie: req.headers.get("cookie") ?? "" },
      body: JSON.stringify({ factoryId: factory.id, email: parsed.data.inviteEmail }),
    });
    inviteMsg = r.ok ? " — invite sent" : " — created; invite failed (send from the card)";
  }
  return NextResponse.json({ ok: true, factoryId: factory.id, designation, message: `${designation} created${inviteMsg}` });
}
