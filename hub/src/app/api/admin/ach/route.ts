// ————— ACH OPS — download the file, mark returns, fail prenotes —————
// The three operator actions the rail needs until DES SFTP automates
// transmission:
//   GET  ?batchId=…      → download the .ach file (upload to FCB manually)
//   POST mark_returned   → payment status 'returned' + code; the
//                          returnsProcessor worker un-applies invoices on
//                          the next cron pass; discount clawback (if the
//                          1% was already granted) is flagged in the owner
//                          alert for manual handling — rare enough that a
//                          human should look anyway.
//   POST fail_prenote    → prenote returned at FCB → account can never pay.
// Owner-only, every action logged.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";
import { sendTemplate } from "@/lib/email";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mark_returned"), paymentId: z.string().uuid(), returnCode: z.string().regex(/^R\d{2}$/) }),
  z.object({ action: z.literal("fail_prenote"), bankAccountId: z.string().uuid() }),
]);

async function requireOwner(sb: ReturnType<typeof supabaseServer>) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: prof } = await sb.from("profiles").select("role").eq("id", user.id).single();
  return prof?.role === "owner" ? user : null;
}

export async function GET(req: NextRequest) {
  const sb = supabaseServer();
  const user = await requireOwner(sb);
  if (!user) return NextResponse.json({ error: "owner only" }, { status: 403 });
  const batchId = req.nextUrl.searchParams.get("batchId") ?? "";
  const { data: batch } = await sb.from("ach_batches")
    .select("id, nacha_content, created_at").eq("id", batchId).single();
  if (!batch?.nacha_content) return NextResponse.json({ error: "not found" }, { status: 404 });
  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: "owner", action: "ach.file.downloaded",
    entity_table: "ach_batches", entity_id: batch.id,
  });
  return new NextResponse(batch.nacha_content, { headers: {
    "content-type": "text/plain",
    "content-disposition": `attachment; filename="SESHSURE-${String(batch.created_at).slice(0, 10)}.ach"`,
  } });
}

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const user = await requireOwner(sb);
  if (!user) return NextResponse.json({ error: "owner only" }, { status: 403 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const b = parsed.data;

  if (b.action === "mark_returned") {
    const { data: p } = await sb.from("payments")
      .select("id, status, amount_cents, discount_granted_at, ach_discount_cents")
      .eq("id", b.paymentId).single();
    if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!["submitted", "settled", "cleared"].includes(p.status))
      return NextResponse.json({ error: `payment is ${p.status} — only submitted/settled/cleared can return` }, { status: 400 });
    await sb.from("payments").update({ status: "returned", return_code: b.returnCode }).eq("id", b.paymentId);
    await sb.from("activity_log").insert({
      actor_profile_id: user.id, actor_label: "owner", action: "payment.returned",
      entity_table: "payments", entity_id: b.paymentId, after: { code: b.returnCode },
    });
    // Owner memo covers the two follow-ups a human should eyeball: the
    // client conversation, and clawback if the 1% was already granted.
    await sendTemplate({
      to: "rob@seshsure.com", templateKey: "system.error",
      vars: { source: `ach.return.${b.returnCode}`,
        message: `Payment returned (${b.returnCode}). Invoices re-open automatically on the next cron pass.${p.discount_granted_at ? ` NOTE: the 1% credit ($${(Number(p.ach_discount_cents) / 100).toFixed(2)}) was already granted — claw back manually.` : ""}`,
        time: new Date().toISOString() },
      systemOverride: true, bccOwner: false,
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  // fail_prenote
  const { error } = await sb.from("client_bank_accounts")
    .update({ prenote_status: "failed" }).eq("id", b.bankAccountId).eq("prenote_status", "sent");
  if (error) return NextResponse.json({ error: "update failed" }, { status: 400 });
  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: "owner", action: "bank.prenote_failed",
    entity_table: "client_bank_accounts", entity_id: b.bankAccountId,
  });
  return NextResponse.json({ ok: true });
}
