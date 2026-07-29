// ————— ORG ADMINS MANAGE THEIR OWN TEAM — escalation-proof —————
// "The people they allow": a client admin invites their AP person, a
// factory admin invites floor users, a forwarder admin invites colleagues.
// Two hard rules make this safe:
//   1. The org binding comes from the CALLER'S profile, never the request —
//      you can only ever invite into your own org.
//   2. Role whitelist per caller role — no path to internal roles, no
//      escalation. A client_ap cannot invite anyone at all.
// Deactivation: org admins can switch a teammate off (not themselves).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

const ALLOWED: Record<string, string[]> = {
  client_admin: ["client_admin", "client_ap"],
  factory_admin: ["factory_admin", "factory_user"],
  forwarder_admin: ["forwarder_admin"],
};

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("invite"), email: z.string().email(), fullName: z.string().min(2).max(120), role: z.string() }),
  z.object({ action: z.literal("deactivate"), profileId: z.string().uuid() }),
  z.object({ action: z.literal("reactivate"), profileId: z.string().uuid() }),
]);

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: me } = await sb.from("profiles")
    .select("role, client_id, factory_id, forwarder_id").eq("id", user.id).single();
  const allowedRoles = me ? ALLOWED[me.role] : undefined;
  if (!me || !allowedRoles) return NextResponse.json({ error: "not permitted" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const b = parsed.data;
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  if (b.action === "invite") {
    if (!allowedRoles.includes(b.role)) return NextResponse.json({ error: "role not permitted" }, { status: 403 });
    const { data: invited, error: invErr } = await svc.auth.admin.inviteUserByEmail(b.email, {
      redirectTo: `${process.env.HUB_URL ?? "https://hub.seshsure.com"}/auth/callback?next=/auth/set-password`,
    });
    if (invErr || !invited?.user) return NextResponse.json({ error: invErr?.message ?? "invite failed" }, { status: 400 });
    await svc.from("profiles").insert({
      id: invited.user.id, role: b.role, full_name: b.fullName, email: b.email,
      client_id: me.client_id, factory_id: me.factory_id, forwarder_id: me.forwarder_id, is_active: true,
    });
    await svc.from("activity_log").insert({
      actor_profile_id: user.id, actor_label: "org_admin", action: "invite.sent",
      entity_table: "profiles", entity_id: invited.user.id, after: { email: b.email, role: b.role },
    });
    return NextResponse.json({ ok: true });
  }

  // (de/re)activate: same org only, never self, via service role after explicit checks.
  if (b.profileId === user.id) return NextResponse.json({ error: "cannot change your own status" }, { status: 400 });
  const { data: target } = await svc.from("profiles")
    .select("id, client_id, factory_id, forwarder_id, role").eq("id", b.profileId).single();
  const sameOrg = !!target && (
    (me.client_id && target.client_id === me.client_id) ||
    (me.factory_id && target.factory_id === me.factory_id) ||
    (me.forwarder_id && target.forwarder_id === me.forwarder_id));
  if (!sameOrg || !allowedRoles.includes(target.role)) return NextResponse.json({ error: "not permitted" }, { status: 403 });

  await svc.from("profiles").update({ is_active: b.action === "reactivate" }).eq("id", b.profileId);
  await svc.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: "org_admin", action: `member.${b.action}d`,
    entity_table: "profiles", entity_id: b.profileId,
  });
  return NextResponse.json({ ok: true });
}
