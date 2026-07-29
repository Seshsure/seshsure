// ————— OWNER INVITES A FORWARDER — two fields, they do the rest —————
// Owner supplies company name + email. This creates the forwarder entity,
// sends a Supabase invite (via the verified Resend SMTP), and pre-wires the
// profile row so the invitee lands as forwarder_admin scoped to exactly
// their company. Invite-only by construction: no open registration path
// for this role exists anywhere.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({
  companyName: z.string().min(2).max(120),
  email: z.string().email().max(160),
});

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if (prof?.role !== "owner") return NextResponse.json({ error: "owner only" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { companyName, email } = parsed.data;

  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Reuse an existing forwarder entity by contact email (re-invite case).
  const { data: existing } = await svc.from("forwarders").select("id").eq("contact_email", email).maybeSingle();
  let forwarderId = existing?.id as string | undefined;
  if (!forwarderId) {
    const { data: fwd, error } = await svc.from("forwarders")
      .insert({ name: companyName, contact_email: email }).select("id").single();
    if (error || !fwd) return NextResponse.json({ error: "could not create forwarder" }, { status: 500 });
    forwarderId = fwd.id;
  }

  const { data: invited, error: invErr } = await svc.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.HUB_URL ?? "https://hub.seshsure.com"}/auth/callback?next=/auth/set-password`,
    data: { company: companyName },
  });
  if (invErr || !invited.user) return NextResponse.json({ error: invErr?.message ?? "invite failed" }, { status: 500 });

  await svc.from("profiles").upsert({
    id: invited.user.id, role: "forwarder_admin", full_name: companyName,
    email, forwarder_id: forwarderId, is_active: true,
  });

  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: "owner", action: "forwarder.invited",
    entity_table: "forwarders", entity_id: forwarderId, after: { email, company: companyName },
  });
  return NextResponse.json({ ok: true, forwarderId });
}
