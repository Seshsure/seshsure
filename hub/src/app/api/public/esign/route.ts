// ————— PUBLIC E-SIGN — tokenized, evidence-grade, no account needed —————
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } });

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (token.length < 20) return NextResponse.json({ error: "bad token" }, { status: 400 });
  const sb = admin();
  const { data: link } = await sb.from("esign_links")
    .select("id, doc_key, recipient_email, recipient_company, expires_at, signed_at").eq("token", token).single();
  if (!link) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (link.signed_at) return NextResponse.json({ error: "already signed" }, { status: 410 });
  if (new Date(link.expires_at) < new Date()) return NextResponse.json({ error: "expired" }, { status: 410 });
  const { data: doc } = await sb.from("agreement_versions")
    .select("id, body_md, version").eq("doc_key", link.doc_key).order("version", { ascending: false }).limit(1).single();
  if (!doc) return NextResponse.json({ error: "document unavailable" }, { status: 500 });
  return NextResponse.json({ ok: true, body: doc.body_md, version: doc.version,
    recipientEmail: link.recipient_email, recipientCompany: link.recipient_company });
}

const Body = z.object({
  token: z.string().min(20),
  signerName: z.string().min(3).max(120),
  signerTitle: z.string().min(2).max(120),
  signerCompany: z.string().min(2).max(200),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "all fields required" }, { status: 400 });
  const b = parsed.data;
  const sb = admin();
  const { data: link } = await sb.from("esign_links")
    .select("id, doc_key, client_id, recipient_email, signed_at, expires_at").eq("token", b.token).single();
  if (!link) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (link.signed_at) return NextResponse.json({ error: "already signed" }, { status: 410 });
  if (new Date(link.expires_at) < new Date()) return NextResponse.json({ error: "expired" }, { status: 410 });

  const { data: doc } = await sb.from("agreement_versions")
    .select("id").eq("doc_key", link.doc_key).order("version", { ascending: false }).limit(1).single();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = req.headers.get("user-agent") ?? null;

  const { data: sig, error } = await sb.from("signatures").insert({
    client_id: link.client_id, agreement_version_id: doc!.id,
    signer_name_typed: b.signerName, signer_title: b.signerTitle,
    signer_email: link.recipient_email, signer_company: b.signerCompany,
    ip, user_agent: ua,
  }).select("id").single();
  if (error || !sig) return NextResponse.json({ error: "signing failed" }, { status: 500 });

  await sb.from("esign_links").update({ signed_at: new Date().toISOString(), signature_id: sig.id }).eq("id", link.id);
  await sb.from("activity_log").insert({
    actor_label: b.signerName, action: `esign.${link.doc_key}.signed`,
    entity_table: "signatures", entity_id: sig.id, client_id: link.client_id,
    after: { company: b.signerCompany, email: link.recipient_email, ip },
  });
  return NextResponse.json({ ok: true, message: "Signed. SeshSure has been notified — samples ship next." });
}
