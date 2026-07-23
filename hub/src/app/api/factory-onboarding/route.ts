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
const Company = z.object({
  step: z.literal("company"),
  factoryId: z.string().uuid(),
  legalName: z.string().min(2),
  addressLine1: z.string().min(3), addressLine2: z.string().optional(),
  city: z.string().min(1), region: z.string().optional(), postalCode: z.string().optional(),
  country: z.string().min(2),
  registrationNo: z.string().optional(), taxId: z.string().optional(),
  panNo: z.string().optional(), iecCode: z.string().optional(),
  contactName: z.string().min(2), contactEmail: z.string().email(),
  contactPhone: z.string().min(5), contactWhatsapp: z.string().optional(),
});
const Banking = z.object({
  step: z.literal("banking"),
  factoryId: z.string().uuid(),
  beneficiaryName: z.string().min(2), bankName: z.string().min(2),
  branchAddress: z.string().min(3), accountNumber: z.string().min(4),
  swift: z.string().min(8).max(11), ifsc: z.string().optional(),
});
const Capabilities = z.object({
  step: z.literal("capabilities"),
  factoryId: z.string().uuid(),
  monthlyCapacityUnits: z.number().int().positive(),
  moqUnits: z.number().int().positive(),
  leadTimeDays: z.number().int().positive(),
});
const DocRecord = z.object({
  step: z.literal("doc_record"),
  factoryId: z.string().uuid(),
  docType: z.enum(["registration","tax_cert","iec","bank_letter","quality_cert","food_contact","other"]),
  filename: z.string().min(1), storagePath: z.string().min(3), note: z.string().max(300).optional(),
});
const Body = z.discriminatedUnion("step", [Terms, PaymentTerms, RateCard, SpecAck, Company, Banking, Capabilities, DocRecord]);

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
  const FACTORY_STEPS = ["company", "banking", "capabilities", "terms", "spec_ack"];
  if (FACTORY_STEPS.includes(b.step)) {
    // the factory tells us who they are; commercial terms stay owner-side
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
  
  if (b.step === "company") {
    if (!isOwner && !isThisFactory) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    await sb.from("factories").update({
      legal_name: b.legalName, name: b.legalName,
      address_line1: b.addressLine1, address_line2: b.addressLine2 ?? null,
      city: b.city, region: b.region ?? null, postal_code: b.postalCode ?? null, country: b.country,
      registration_no: b.registrationNo ?? null, tax_id: b.taxId ?? null,
      pan_no: b.panNo ?? null, iec_code: b.iecCode ?? null,
      contact_name: b.contactName, contact_email: b.contactEmail,
      contact_phone: b.contactPhone, contact_whatsapp: b.contactWhatsapp ?? null,
    }).eq("id", b.factoryId);
    await sb.from("activity_log").insert({ actor_profile_id: user.id, actor_label: prof?.full_name ?? "", action: "factory.company_completed", entity_table: "factories", entity_id: b.factoryId });
    return NextResponse.json({ ok: true });
  }
  if (b.step === "banking") {
    if (!isOwner && !isThisFactory) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const { data: f } = await sb.from("factories").select("wire_details_enc").eq("id", b.factoryId).single();
    const firstSet = !f?.wire_details_enc;
    await sb.from("factories").update({
      wire_details_enc: JSON.stringify({ beneficiary: b.beneficiaryName, bank: b.bankName, branch: b.branchAddress, account: b.accountNumber, swift: b.swift, ifsc: b.ifsc ?? null }),
      wire_change_pending: firstSet ? false : true,   // changes after first set freeze payments pending voice-confirm
    }).eq("id", b.factoryId);
    await sb.from("activity_log").insert({ actor_profile_id: user.id, actor_label: prof?.full_name ?? "", action: firstSet ? "factory.banking_set" : "factory.banking_CHANGED_pending_voice_confirm", entity_table: "factories", entity_id: b.factoryId });
    return NextResponse.json({ ok: true, pendingVerification: !firstSet });
  }
  if (b.step === "capabilities") {
    if (!isOwner && !isThisFactory) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    await sb.from("factories").update({
      monthly_capacity_units: b.monthlyCapacityUnits, moq_units: b.moqUnits, lead_time_days: b.leadTimeDays,
    }).eq("id", b.factoryId);
    return NextResponse.json({ ok: true });
  }
  if (b.step === "doc_record") {
    if (!isOwner && !isThisFactory) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    await sb.from("factory_documents").insert({
      factory_id: b.factoryId, doc_type: b.docType, filename: b.filename, storage_path: b.storagePath, note: b.note ?? null, uploaded_by: user.id,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
