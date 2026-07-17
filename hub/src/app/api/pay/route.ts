// ————— PAYMENT AUTHORIZATION — the money artery's heart —————
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";
import { railFor } from "@/lib/rail";
import { pctOf } from "@/lib/money";

const Body = z.object({
  invoiceId: z.string().uuid(),
  amountCents: z.string().regex(/^\d+$/),
  scheduledFor: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const amount = BigInt(parsed.data.amountCents);
  if (amount <= 0n) return NextResponse.json({ error: "amount must be positive" }, { status: 400 });

  const { data: prof } = await sb.from("profiles").select("client_id, full_name, role").eq("id", user.id).single();
  if (!prof?.client_id) return NextResponse.json({ error: "no client" }, { status: 403 });

  const { data: inv } = await sb.from("invoices")
    .select("id, invoice_number, client_id, status, total_cents, paid_cents, due_date")
    .eq("id", parsed.data.invoiceId).single();
  if (!inv || inv.client_id !== prof.client_id) return NextResponse.json({ error: "invoice not found" }, { status: 404 });
  if (["paid", "void", "draft"].includes(inv.status)) return NextResponse.json({ error: "invoice not payable" }, { status: 400 });

  const remaining = BigInt(inv.total_cents) - BigInt(inv.paid_cents);
  if (amount > remaining) return NextResponse.json({ error: "amount exceeds remaining balance" }, { status: 400 });

  const { data: client } = await sb.from("clients")
    .select("accepted_methods, hold_active").eq("id", prof.client_id).single();
  if (!client?.accepted_methods?.includes("ach"))
    return NextResponse.json({ error: "portal pay not enabled for this account" }, { status: 403 });

  const floorOn = true; // reads client_settings when the settings slice lands
  if (floorOn && amount < remaining) {
    const floor = pctOf(remaining, 2500n);
    if (amount < floor) return NextResponse.json({ error: `minimum partial payment is 25% (${floor.toString()} cents) — or pay any amount if your account has the floor disabled` }, { status: 400 });
  }

  const { data: bank } = await sb.from("client_bank_accounts")
    .select("id, check_verified, micro_verified, account_last4")
    .eq("client_id", prof.client_id).eq("is_active", true).single();
  if (!bank) return NextResponse.json({ error: "no bank account on file — add one from your Money page" }, { status: 400 });
  if (!bank.micro_verified) return NextResponse.json({ error: "bank verification finishing — enter your micro-deposit amounts first" }, { status: 400 });

  if (parsed.data.scheduledFor && inv.due_date && parsed.data.scheduledFor > inv.due_date)
    return NextResponse.json({ error: "scheduled date must be on or before the due date" }, { status: 400 });

  const { data: payment, error: pErr } = await sb.from("payments").insert({
    client_id: prof.client_id, method: "ach",
    status: parsed.data.scheduledFor ? "scheduled" : "authorized",
    amount_cents: amount.toString(),
    scheduled_for: parsed.data.scheduledFor ?? null,
    bank_account_id: bank.id,
  }).select("id").single();
  if (pErr || !payment) return NextResponse.json({ error: pErr?.message ?? "payment write failed" }, { status: 500 });

  await sb.from("payment_allocations").insert({
    payment_id: payment.id, invoice_id: inv.id, amount_cents: amount.toString(),
  });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? null;
  await sb.from("ach_authorizations").insert({
    payment_id: payment.id, client_id: prof.client_id,
    amount_cents: amount.toString(), invoice_numbers: [inv.invoice_number],
    authorized_by: user.id, authorized_name: prof.full_name,
    ip, user_agent: req.headers.get("user-agent"),
  });

  const rail = railFor("ach");
  const res = await rail.debit({
    paymentId: payment.id, amountCents: amount,
    accountToken: bank.id, descriptor: "SESHSURE",
    effectiveDate: parsed.data.scheduledFor,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 502 });

  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: prof.full_name,
    action: "payment.authorized", entity_table: "payments", entity_id: payment.id,
    client_id: prof.client_id,
    after: { amount_cents: amount.toString(), invoice: inv.invoice_number, rail: rail.name },
  });

  return NextResponse.json({ ok: true, paymentId: payment.id });
}
