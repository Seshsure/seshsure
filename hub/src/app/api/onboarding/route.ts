import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";
import { completeStep } from "@/lib/onboarding";

const Company = z.object({
  step: z.literal("company"),
  legal_name: z.string().min(2),
  dba: z.string().optional(),
  entity_type: z.string().optional(),
  formation_state: z.string().optional(),
  ein: z.string().regex(/^\d{2}-?\d{7}$/).optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().optional(),
  license: z.string().optional(),
  lead_source: z.string().optional(),
});

const Team = z.object({
  step: z.literal("team"),
  members: z.array(z.object({
    name: z.string().min(2),
    email: z.string().email(),
    role: z.enum(["client_admin", "client_ap"]),
  })).min(1),
});

const Shipping = z.object({
  step: z.literal("shipping"),
  addresses: z.array(z.object({
    label: z.string().min(1),
    address: z.string().min(6),
    receiving_notes: z.string().optional(),
    receiver_name: z.string().optional(),
    receiver_phone: z.string().optional(),
  })).min(1),
});

const Agreements = z.object({
  step: z.literal("agreements"),
  signer_name_typed: z.string().min(3),
  signer_title: z.string().min(2),
  accepted_doc_keys: z.array(z.string()).min(2),
});

const Payment = z.object({
  step: z.literal("payment"),
  preferred_method: z.enum(["ach", "wire", "check", "cash"]),
});

const Body = z.discriminatedUnion("step", [Company, Team, Shipping, Agreements, Payment]);

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const { data: prof } = await sb.from("profiles")
    .select("client_id, role, full_name").eq("id", user.id).single();
  if (!prof?.client_id || prof.role !== "client_admin")
    return NextResponse.json({ error: "client_admin only" }, { status: 403 });
  const clientId = prof.client_id;

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;

  if (b.step === "company") {
    const { error } = await sb.from("clients").update({
      legal_name: b.legal_name, dba: b.dba, entity_type: b.entity_type,
      formation_state: b.formation_state, ein: b.ein || null,
      phone: b.phone, website: b.website, lead_source: b.lead_source,
    }).eq("id", clientId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (b.license) await sb.from("client_licenses").insert({ client_id: clientId, license_number: b.license });
  }

  if (b.step === "team") {
    for (const m of b.members) {
      await sb.from("client_contacts").upsert(
        { client_id: clientId, role: m.role === "client_ap" ? "ap" : "purchasing", name: m.name, email: m.email },
        { onConflict: "id" });
    }
  }

  if (b.step === "shipping") {
    for (const a of b.addresses) {
      await sb.from("client_addresses").insert({
        client_id: clientId, label: a.label, address: a.address,
        receiving_notes: [a.receiving_notes, a.receiver_name && `Receiver: ${a.receiver_name}`, a.receiver_phone]
          .filter(Boolean).join(" · "),
      });
    }
  }

  if (b.step === "agreements") {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? null;
    const ua = req.headers.get("user-agent");
    for (const key of b.accepted_doc_keys) {
      const { data: ver } = await sb.from("agreement_versions")
        .select("id").eq("doc_key", key).order("version", { ascending: false }).limit(1).single();
      if (ver) {
        await sb.from("signatures").insert({
          client_id: clientId, agreement_version_id: ver.id,
          signer_profile_id: user.id, signer_name_typed: b.signer_name_typed,
          signer_title: b.signer_title, ip, user_agent: ua,
        });
      }
    }
  }

  if (b.step === "payment") {
    await sb.from("clients").update({ preferred_method: b.preferred_method }).eq("id", clientId);
  }

  await completeStep(clientId, b.step);
  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: prof.full_name,
    action: `onboarding.${b.step}.completed`, entity_table: "clients", entity_id: clientId, client_id: clientId,
  });
  return NextResponse.json({ ok: true });
}
