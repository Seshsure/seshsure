// ————— PORTAL INVITE — owner only —————
// Creates (or reuses) the auth user for a client contact, ties the profile to the
// client, and sends the branded invite. Litigation-held clients are refused.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

const Body = z.object({ clientId: z.string().uuid(), email: z.string().email(), name: z.string().optional() });

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (prof?.role !== "owner") return NextResponse.json({ error: "owner only" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { clientId, email, name } = parsed.data;

  const { data: client } = await sb.from("clients").select("id, legal_name, dba, hold_active").eq("id", clientId).single();
  if (!client) return NextResponse.json({ error: "client not found" }, { status: 404 });
  if (client.hold_active)
    return NextResponse.json({ error: "client is on hold — resolve the hold before inviting to the portal" }, { status: 422 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.HUB_URL ?? "https://hub.seshsure.com"}/signup`,
    data: { client_id: clientId, invited_name: name ?? null },
  });
  if (error && !/already been registered/i.test(error.message))
    return NextResponse.json({ error: error.message }, { status: 500 });

  const uid = invited?.user?.id;
  if (uid) {
    await admin.from("profiles").upsert({
      id: uid, email, full_name: name ?? email.split("@")[0], role: "client_admin", client_id: clientId,
    }, { onConflict: "id" });
  }
  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: prof.full_name ?? "owner",
    action: "client.portal_invited", entity_table: "clients", entity_id: clientId, client_id: clientId,
    after: { email },
  });
  return NextResponse.json({ ok: true, message: `Invite sent to ${email}` });
}
