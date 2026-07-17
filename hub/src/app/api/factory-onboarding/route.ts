// ————— FACTORY ONBOARDING WIZARD (owner-initiated, factory-completed) —————
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Terms = z.object({
  step: z.literal("terms"),
  factoryId: z.string().uuid(),
  signerName: z.string().min(3),
  signerTitle: z.string().min(2),
  acceptedDocKeys: z.array(z.string()).min(1),
});
const PaymentTerms = z.object({
  step: z.literal("payment_terms"),
  factoryId: z.string().uuid(),
  paymentTerms: z.enum(["net15","net30","net45","on_shipment"]),
  earlyPayDiscountBps: z.number().int().min(0).max(500).optional(),
  currency: z.literal("USD"),
  country: z.string().min(2),
});
const RateCard = z.object({
  step: z.literal("rate_card"),
  factoryId: z.string().uuid(),
  rates: z.array(z.object({
    productId: z.string().uuid(),
    costPerConeCents: z.string(),
  })).min(1),
});
const SpecAck = z.object({
  step: z.literal("spec_ack"),
  factoryId: z.string().uuid(),
  specVersionIds: z.array(z.string().uuid()).min(1),
});
const Body = z.discriminatedUnion("step", [Terms, PaymentTerms, RateCard, SpecAck]);

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("role, factory_id, full_name").eq("id", user.id).single();

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;

  const isOwner = prof?.role === "owner";
  const isThisFactory = prof?.factory_id === b.factoryId;
  if (b.step === "terms" || b.step === "spec_ack") {
    if (!isThisFactory && !isOwner) return NextResponse.json({ error: "factory member only" }, { status: 403 });
  } else if (!isOwner) return NextResponse.json({ error: "owner only" }, { status: 403 });

  if (b.step === "terms") {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? null;
    for (const key of b.acceptedDocKeys) {
      const { data: ver } = await sb.from("agreement_versions")
        .select("id").eq("doc_key", key).order("version", { ascending: false }).limit(1).single();
      if (ver) await sb.from("signatures").insert({
        factory_id: b.factoryId, agreement_version_id: ver.id,
        signer_profile_id: user.id, signer_name_typed: b.signerName, signer_title: b.signerTitle,
        ip, user_agent: req.headers.get("user-agent"),
      });
    }
  }
  if (b.step === "payment_terms") {
    await sb.from("factories").update({
      payment_terms: b.paymentTerms,
      early_pay_discount_bps: b.earlyPayDiscountBps ?? null,
      currency: b.currency, country: b.country,
    }).eq("id", b.factoryId);
  }
  if (b.step === "rate_card") {
    for (const r of b.rates) {
      const cents = parseFloat(r.costPerConeCents);
      if (!(cents > 0)) return NextResponse.json({ error: `invalid rate for ${r.productId}` }, { status: 400 });
      await sb.from("factory_rate_card").insert({
        factory_id: b.factoryId, product_id: r.productId,
        cost_per_cone_microcents: BigInt(Math.round(cents * 10000)).toString(),
        effective_at: new Date().toISOString(),
      });
    }
  }
  if (b.step === "spec_ack") {
    for (const specId of b.specVersionIds) {
      await sb.from("spec_acknowledgments").insert({
        factory_id: b.factoryId, spec_version_id: specId, acknowledged_by: user.id,
      });
    }
  }

  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: prof?.full_name ?? "?",
    action: `factory_onboarding.${b.step}`, entity_table: "factories", entity_id: b.factoryId,
  });
  return NextResponse.json({ ok: true });
}
