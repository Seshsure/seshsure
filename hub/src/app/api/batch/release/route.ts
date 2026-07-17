// ————— THE DAILY BATCH TAP — Rob's two-tap release —————
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";
import { buildNacha } from "@/lib/nacha";

const Body = z.object({ confirm: z.literal(true), expectedTotalCents: z.string().regex(/^\d+$/) });

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (prof?.role !== "owner") return NextResponse.json({ error: "owner only — the tap is yours alone" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "confirmation required" }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);
  const { data: ready } = await sb.from("payments")
    .select("id, amount_cents, client_id, bank_account_id, clients(legal_name)")
    .in("status", ["authorized", "scheduled"])
    .or(`scheduled_for.is.null,scheduled_for.lte.${today}`);

  if (!ready?.length) return NextResponse.json({ error: "nothing ready to release" }, { status: 400 });

  const total = ready.reduce((s, p) => s + BigInt(p.amount_cents), 0n);
  if (total.toString() !== parsed.data.expectedTotalCents)
    return NextResponse.json({ error: "batch changed since you looked — refresh and re-confirm", totalCents: total.toString() }, { status: 409 });

  const entries = [];
  for (const [i, p] of ready.entries()) {
    const { data: bank } = await sb.from("client_bank_accounts")
      .select("routing_number, account_number_enc").eq("id", p.bank_account_id).single();
    if (!bank) continue;
    entries.push({
      routing: bank.routing_number,
      account: bank.account_number_enc,
      amountCents: BigInt(p.amount_cents),
      name: ((p.clients as unknown as { legal_name: string })?.legal_name ?? "CLIENT").toUpperCase().slice(0, 22),
      txCode: "27" as const,
      traceSeq: i + 1,
    });
  }

  const effective = new Date();
  effective.setDate(effective.getDate() + 1);
  const nacha = buildNacha({
    entries,
    companyName: "SESHSURE",
    companyId: process.env.ACH_COMPANY_ID ?? "0000000000",
    odfiRouting: process.env.ODFI_ROUTING ?? "053100300",
    effectiveDate: effective.toISOString().slice(2, 10).replace(/-/g, ""),
    description: "INVOICE",
  });

  const { data: batch } = await sb.from("ach_batches").insert({
    released_by: user.id, entry_count: entries.length,
    total_cents: total.toString(), nacha_content: nacha, status: "released",
  }).select("id").single();

  for (const p of ready) {
    await sb.from("payments").update({ status: "submitted", batch_id: batch?.id }).eq("id", p.id);
  }
  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: prof.full_name,
    action: "batch.released", entity_table: "ach_batches", entity_id: batch?.id,
    after: { entries: entries.length, total_cents: total.toString() },
  });

  return NextResponse.json({ ok: true, batchId: batch?.id, entries: entries.length, totalCents: total.toString() });
}
