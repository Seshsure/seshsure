// ————— ARCADE ACCESS — apply (client) / decide (owner) —————
// Approval is the compliance moment: APPROVE is refused unless the
// counsel-reviewed sweepstakes rules doc is attached in the same call —
// the SOP's "never a launch blocker later" rule, enforced structurally.
// Every transition writes the immutable access log.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { sendTemplate } from "@/lib/email";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("apply"), note: z.string().max(500).optional() }),
  z.object({
    action: z.enum(["approve", "deny", "suspend", "reinstate"]),
    clientId: z.string().uuid(),
    note: z.string().max(500).optional(),
    rulesDocPath: z.string().max(300).optional(),   // required for approve
    slug: z.string().regex(/^[a-z0-9-]{3,40}$/).optional(), // required for approve
  }),
]);

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: me } = await sb.from("profiles").select("role, client_id, email, full_name").eq("id", user.id).single();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const b = parsed.data;
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // ————— CLIENT APPLIES —————
  if (b.action === "apply") {
    if (me?.role !== "client_admin" || !me.client_id)
      return NextResponse.json({ error: "client admins only" }, { status: 403 });
    const { data: existing } = await svc.from("arcade_access").select("status").eq("client_id", me.client_id).maybeSingle();
    if (existing && existing.status !== "denied")
      return NextResponse.json({ error: "already applied" }, { status: 400 });
    await svc.from("arcade_access").upsert({
      client_id: me.client_id, status: "applied", applied_by: user.id,
      application_note: b.note ?? null, applied_at: new Date().toISOString(),
      decided_by: null, decided_at: null, decision_note: null,
    });
    await svc.from("arcade_access_log").insert({
      client_id: me.client_id, from_status: existing?.status ?? "not_applied",
      to_status: "applied", actor: user.id, note: b.note ?? null,
    });
    await sendTemplate({
      to: "rob@seshsure.com", templateKey: "arcade.application",
      vars: { name: me.full_name ?? "A client", note: b.note ?? "—" },
      systemOverride: true, bccOwner: false,
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  // ————— OWNER DECIDES —————
  if (me?.role !== "owner") return NextResponse.json({ error: "owner only" }, { status: 403 });
  const { data: access } = await svc.from("arcade_access").select("status").eq("client_id", b.clientId).single();
  if (!access) return NextResponse.json({ error: "no application" }, { status: 404 });

  let patch: Record<string, unknown> = { decided_by: user.id, decided_at: new Date().toISOString(), decision_note: b.note ?? null };
  if (b.action === "approve") {
    // The compliance gate: no rules doc, no approval. Ever.
    if (!b.rulesDocPath) return NextResponse.json(
      { error: "attach the counsel-reviewed sweepstakes rules doc to approve" }, { status: 400 });
    if (!b.slug) return NextResponse.json({ error: "pick an arcade slug" }, { status: 400 });
    patch = { ...patch, status: "approved", rules_doc_path: b.rulesDocPath,
      rules_doc_attached_at: new Date().toISOString(), arcade_slug: b.slug, suspended_at: null };
  } else if (b.action === "deny") {
    patch = { ...patch, status: "denied" };
  } else if (b.action === "suspend") {
    // Suspends new orders + new hunts; live hunts run to published end dates.
    patch = { ...patch, status: "suspended", suspended_at: new Date().toISOString() };
  } else {
    if (access.status !== "suspended") return NextResponse.json({ error: "not suspended" }, { status: 400 });
    patch = { ...patch, status: "approved", suspended_at: null };
  }

  const { error } = await svc.from("arcade_access").update(patch).eq("client_id", b.clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await svc.from("arcade_access_log").insert({
    client_id: b.clientId, from_status: access.status,
    to_status: String(patch.status), actor: user.id, note: b.note ?? null,
  });
  return NextResponse.json({ ok: true });
}
