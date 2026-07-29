// ————— OWNER INVITES ANYONE — email + role, they do the rest —————
// The owner types an email and picks a role; optionally creates the org
// (client / factory / forwarder) in the same motion. Supabase sends the
// invite through our branded SMTP; the invitee sets their OWN password at
// /auth/set-password and completes their own profile. No credential ever
// passes through the owner or this chat again.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

const Body = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(120),
  role: z.enum(["staff", "client_admin", "client_ap", "factory_admin", "factory_user", "forwarder_admin"]),
  // existing org…
  clientId: z.string().uuid().optional(),
  factoryId: z.string().uuid().optional(),
  forwarderId: z.string().uuid().optional(),
  // …or create one inline
  newOrg: z.object({
    type: z.enum(["client", "factory", "forwarder"]),
    name: z.string().min(2).max(160),
  }).optional(),
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

  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Resolve or create the org binding. Role and org type must agree.
  let clientId = b.clientId ?? null, factoryId = b.factoryId ?? null, forwarderId = b.forwarderId ?? null;
  if (b.newOrg) {
    if (b.newOrg.type === "client") {
      const { data } = await svc.from("clients").insert({ legal_name: b.newOrg.name, status: "active" }).select("id").single();
      clientId = data?.id ?? null;
    } else if (b.newOrg.type === "factory") {
      const { data } = await svc.from("factories").insert({ name: b.newOrg.name, contact_email: b.email, is_active: true }).select("id").single();
      factoryId = data?.id ?? null;
    } else {
      const { data } = await svc.from("forwarders").insert({ name: b.newOrg.name, contact_email: b.email }).select("id").single();
      forwarderId = data?.id ?? null;
    }
  }
  const roleNeeds = b.role.startsWith("client") ? !!clientId : b.role.startsWith("factory") ? !!factoryId : b.role === "forwarder_admin" ? !!forwarderId : true;
  if (!roleNeeds) return NextResponse.json({ error: "role needs an org (pick existing or create one)" }, { status: 400 });

  // Invite: creates the auth user and emails a set-your-password link.
  const { data: invited, error: invErr } = await svc.auth.admin.inviteUserByEmail(b.email, {
    redirectTo: `${process.env.HUB_URL ?? "https://hub.seshsure.com"}/auth/callback?next=/auth/set-password`,
  });
  if (invErr || !invited?.user) return NextResponse.json({ error: invErr?.message ?? "invite failed" }, { status: 400 });

  await svc.from("profiles").insert({
    id: invited.user.id, role: b.role, full_name: b.fullName, email: b.email,
    client_id: clientId, factory_id: factoryId, forwarder_id: forwarderId, is_active: true,
  });
  await svc.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: "owner", action: "invite.sent",
    entity_table: "profiles", entity_id: invited.user.id,
    after: { email: b.email, role: b.role, new_org: b.newOrg?.name ?? null },
  });
  return NextResponse.json({ ok: true });
}
