// Payment plans / stipulations — targets 0003's payment_plans + plan_installments
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({
  clientId: z.string().uuid(),
  caseLabel: z.string().optional(),
  installments: z.array(z.object({
    dueOn: z.string(),
    amountCents: z.string().regex(/^\d+$/),
  })).min(1),
  certifiedFundsOnly: z.boolean().default(true),
  acceleration: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (prof?.role !== "owner") return NextResponse.json({ error: "owner only" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;
  const total = b.installments.reduce((s, i) => s + BigInt(i.amountCents), 0n);

  const { data: plan, error } = await sb.from("payment_plans").insert({
    client_id: b.clientId, case_label: b.caseLabel ?? null,
    total_cents: total.toString(), certified_funds_only: b.certifiedFundsOnly,
    acceleration: b.acceleration, status: "active", created_by: user.id,
  }).select("id").single();
  if (error || !plan) return NextResponse.json({ error: error?.message }, { status: 500 });

  for (const [i, inst] of b.installments.entries()) {
    await sb.from("plan_installments").insert({
      plan_id: plan.id, seq: i + 1, due_date: inst.dueOn, amount_cents: inst.amountCents,
    });
  }
  await sb.from("invoices").update({ interest_frozen: true })
    .eq("client_id", b.clientId).eq("status", "overdue");

  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: prof.full_name,
    action: "legal.payment_plan_created", entity_table: "payment_plans", entity_id: plan.id,
    client_id: b.clientId,
    after: { total_cents: total.toString(), installments: b.installments.length, acceleration: b.acceleration },
  });
  return NextResponse.json({ ok: true, planId: plan.id, totalCents: total.toString() });
}
