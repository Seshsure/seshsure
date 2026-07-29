// ————— APPLICATION DECISION — approve creates client + invite in one motion —————
// Owner-only. Approve: client row from the application, contact record,
// client_admin invite through the standard machinery (they set their own
// password; MSA gate meets them at first login — verification continues
// into onboarding). Deny: closed quietly, no email to the applicant.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

const Body = z.object({ applicationId: z.string().uuid(), action: z.enum(["approve", "deny"]) });

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if (prof?.role !== "owner") return NextResponse.json({ error: "owner only" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: app } = await svc.from("access_applications")
    .select("*").eq("id", parsed.data.applicationId).eq("status", "pending").single();
  if (!app) return NextResponse.json({ error: "not pending" }, { status: 404 });

  if (parsed.data.action === "deny") {
    await svc.from("access_applications").update({ status: "denied", decided_by: user.id, decided_at: new Date().toISOString() }).eq("id", app.id);
    return NextResponse.json({ ok: true });
  }

  const { data: client } = await svc.from("clients").insert({
    legal_name: app.company, status: "active", phone: app.phone, website: app.website,
    lead_source: app.ref_code ? `apply:${app.ref_code}` : "apply:direct",
  }).select("id").single();
  if (!client) return NextResponse.json({ error: "client create failed" }, { status: 500 });

  await svc.from("client_contacts").insert({ client_id: client.id, name: app.contact_name, email: app.email, role: "ap" });

  const { data: invited, error: invErr } = await svc.auth.admin.inviteUserByEmail(app.email, {
    redirectTo: `${process.env.HUB_URL ?? "https://hub.seshsure.com"}/auth/callback?next=/auth/set-password`,
  });
  if (invErr || !invited?.user) return NextResponse.json({ error: invErr?.message ?? "invite failed" }, { status: 400 });
  await svc.from("profiles").insert({
    id: invited.user.id, role: "client_admin", full_name: app.contact_name,
    email: app.email, client_id: client.id, is_active: true,
  });

  await svc.from("access_applications").update({ status: "approved", decided_by: user.id, decided_at: new Date().toISOString() }).eq("id", app.id);
  await svc.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: "owner", action: "application.approved",
    entity_table: "clients", entity_id: client.id,
    after: { company: app.company, email: app.email, ref: app.ref_code },
  });
  return NextResponse.json({ ok: true });
}
