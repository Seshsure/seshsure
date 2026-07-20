// ————— NEW CLIENT — owner only —————
// Creates the client shell; optionally fires the portal invite in the same motion.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({
  legalName: z.string().min(2),
  dba: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  leadSource: z.string().min(2),
  invite: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (prof?.role !== "owner") return NextResponse.json({ error: "owner only" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const b = parsed.data;

  const { data: client, error } = await sb.from("clients").insert({
    legal_name: b.legalName, dba: b.dba ?? null, phone: b.phone ?? null,
    status: "active", lead_source: b.leadSource,
  }).select("id").single();
  if (error || !client) return NextResponse.json({ error: error?.message }, { status: 500 });

  if (b.email) {
    await sb.from("client_contacts").insert({ client_id: client.id, role: "purchasing", name: b.legalName, email: b.email, phone: b.phone ?? null });
  }
  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: prof.full_name ?? "owner",
    action: "client.created", entity_table: "clients", entity_id: client.id, client_id: client.id,
    after: { legal_name: b.legalName, lead_source: b.leadSource },
  });

  let inviteMsg = "";
  if (b.invite && b.email) {
    const r = await fetch(new URL("/api/clients/invite", req.url), {
      method: "POST", headers: { "content-type": "application/json", cookie: req.headers.get("cookie") ?? "" },
      body: JSON.stringify({ clientId: client.id, email: b.email }),
    });
    inviteMsg = r.ok ? " — invite sent" : " — created, but invite failed (send from their page)";
  }
  return NextResponse.json({ ok: true, clientId: client.id, message: `Client created${inviteMsg}` });
}
