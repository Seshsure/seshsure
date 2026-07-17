import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({ amount1: z.number().int().min(1).max(99), amount2: z.number().int().min(1).max(99) });
const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("client_id, full_name").eq("id", user.id).single();
  if (!prof?.client_id) return NextResponse.json({ error: "no client" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "enter both amounts in cents (1–99)" }, { status: 400 });

  const { data: bank } = await sb.from("client_bank_accounts")
    .select("id, micro_amount_1, micro_amount_2, micro_attempts, micro_verified")
    .eq("client_id", prof.client_id).eq("is_active", true).single();
  if (!bank) return NextResponse.json({ error: "no bank account on file" }, { status: 400 });
  if (bank.micro_verified) return NextResponse.json({ ok: true, already: true });
  if (bank.micro_attempts >= MAX_ATTEMPTS)
    return NextResponse.json({ error: "too many attempts — contact support@seshsure.com" }, { status: 429 });

  const match =
    (bank.micro_amount_1 === parsed.data.amount1 && bank.micro_amount_2 === parsed.data.amount2) ||
    (bank.micro_amount_1 === parsed.data.amount2 && bank.micro_amount_2 === parsed.data.amount1);

  await sb.from("client_bank_accounts")
    .update({ micro_attempts: bank.micro_attempts + 1, micro_verified: match })
    .eq("id", bank.id);

  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: prof.full_name,
    action: match ? "bank.micro_verified" : "bank.micro_attempt_failed",
    entity_table: "client_bank_accounts", entity_id: bank.id, client_id: prof.client_id,
  });

  return match
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: `amounts don't match — ${MAX_ATTEMPTS - bank.micro_attempts - 1} attempts left` }, { status: 400 });
}
