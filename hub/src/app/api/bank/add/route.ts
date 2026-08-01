// ————— ADD BANK ACCOUNT — authorization captured, prenote queued —————
// The standing authorization is signed HERE (typed name + timestamp + IP +
// text version — the NACHA evidence trail); each actual debit still
// requires a PAY press. The account starts at prenote 'queued': a $0 test
// entry rides the next batch, and PAY unlocks only after verification.
// AUTH TEXT v1 is a draft — on the attorney pile with the agreements.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { validRouting } from "@/lib/nacha";

const AUTH_TEXT_VERSION = "CCD-AUTH-v1-DRAFT";

const Body = z.object({
  bankName: z.string().min(2).max(80),
  routing: z.string().regex(/^\d{9}$/),
  account: z.string().regex(/^\d{4,17}$/),
  accountType: z.enum(["checking", "savings"]),
  nameOnAccount: z.string().min(2).max(80),
  signedName: z.string().min(2).max(80),     // typed signature on the authorization
});

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: me } = await sb.from("profiles").select("role, client_id, full_name").eq("id", user.id).single();
  if (me?.role !== "client_admin" || !me.client_id)
    return NextResponse.json({ error: "client admins only" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "bad request" }, { status: 400 });
  const b = parsed.data;
  if (!validRouting(b.routing))
    return NextResponse.json({ error: "routing number fails its check digit — double-check it" }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // One active account at a time: new account supersedes.
  await svc.from("client_bank_accounts").update({ is_active: false }).eq("client_id", me.client_id).eq("is_active", true);
  const { error } = await svc.from("client_bank_accounts").insert({
    client_id: me.client_id, bank_name: b.bankName,
    routing_number_enc: b.routing, account_number_enc: b.account,
    account_last4: b.account.slice(-4), account_type: b.accountType,
    name_on_account: b.nameOnAccount, is_active: true,
    prenote_status: "queued",
    auth_signed_name: b.signedName, auth_signed_at: new Date().toISOString(),
    auth_ip: ip, auth_text_version: AUTH_TEXT_VERSION,
  });
  if (error) return NextResponse.json({ error: "save failed" }, { status: 500 });

  await svc.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: "client", action: "bank.added",
    entity_table: "client_bank_accounts", client_id: me.client_id,
    after: { last4: b.account.slice(-4), auth_version: AUTH_TEXT_VERSION, ip },
  });
  return NextResponse.json({ ok: true, verification: "A $0 test transaction verifies this account — typically 3 business days. You'll get an email when bank pay unlocks (with the 1% discount)." });
}
