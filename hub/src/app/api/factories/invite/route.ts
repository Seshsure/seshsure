// ————— FACTORY PORTAL INVITE — owner only —————
// Creates the factory-side login (factory_admin), ties it to the factory,
// and sends the branded invite pointing at the factory onboarding wizard.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

const Body = z.object({ factoryId: z.string().uuid(), email: z.string().email(), name: z.string().optional() });

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (prof?.role !== "owner") return NextResponse.json({ error: "owner only" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { factoryId, email, name } = parsed.data;

  const { data: factory } = await sb.from("factories").select("id, name, is_active").eq("id", factoryId).single();
  if (!factory) return NextResponse.json({ error: "factory not found" }, { status: 404 });
  if (!factory.is_active) return NextResponse.json({ error: "factory is inactive" }, { status: 422 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.HUB_URL ?? "https://hub.seshsure.com"}/factory/onboarding`,
    data: { factory_id: factoryId, invited_name: name ?? null },
  });
  if (error && !/already been registered/i.test(error.message))
    return NextResponse.json({ error: error.message }, { status: 500 });

  const uid = invited?.user?.id;
  if (uid) {
    await admin.from("profiles").upsert({
      id: uid, email, full_name: name ?? email.split("@")[0], role: "factory_admin", factory_id: factoryId,
    }, { onConflict: "id" });
  }
  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: prof.full_name ?? "owner",
    action: "factory.portal_invited", entity_table: "factories", entity_id: factoryId, after: { email },
  });
  return NextResponse.json({ ok: true, message: `Factory invite sent to ${email}` });
}
