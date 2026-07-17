import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({ preferred: z.enum(["ach", "wire", "check", "cash", "card"]) });

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("client_id, full_name").eq("id", user.id).single();
  if (!prof?.client_id) return NextResponse.json({ error: "no client" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const { data: client } = await sb.from("clients").select("accepted_methods").eq("id", prof.client_id).single();
  if (!client?.accepted_methods?.includes(parsed.data.preferred))
    return NextResponse.json({ error: "that method isn't enabled for your account — ask us and we'll switch it on" }, { status: 403 });

  await sb.from("clients").update({ preferred_method: parsed.data.preferred }).eq("id", prof.client_id);
  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: prof.full_name,
    action: "client.payment_method.changed", entity_table: "clients",
    entity_id: prof.client_id, client_id: prof.client_id,
    after: { preferred: parsed.data.preferred },
  });
  return NextResponse.json({ ok: true });
}
