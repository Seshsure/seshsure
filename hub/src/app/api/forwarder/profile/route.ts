// ————— FORWARDER COMPLETES THEIR OWN PROFILE —————
// RLS confines to their own forwarders row. Banking is the guarded field:
// any change to wire details sets wire_change_pending, which freezes
// payment runs to this forwarder until voice-confirmed by the owner —
// identical discipline to factory banking. Everything else is theirs to
// keep current.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({
  legalName: z.string().min(2).max(120),
  dba: z.string().max(120).optional(),
  address: z.string().min(6).max(240),
  opsPhone: z.string().min(7).max(30),
  afterHoursContact: z.string().max(160).optional(),
  scacCode: z.string().regex(/^[A-Z]{2,4}$/).optional().or(z.literal("")),
  iataNumber: z.string().max(20).optional(),
  fmcOtiNumber: z.string().max(20).optional(),
  customsBrokerLicense: z.string().max(30).optional(),
  services: z.array(z.enum(["air", "ocean", "customs", "trucking", "warehousing"])).min(1),
  originLanes: z.string().min(2).max(300),
  insuranceCarrier: z.string().max(120).optional(),
  cargoCoverageUsd: z.number().int().positive().max(1000000000).optional(),
  wireDetails: z.string().max(1200).optional(),   // presence = change requested
});

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("forwarder_id").eq("id", user.id).single();
  if (!prof?.forwarder_id) return NextResponse.json({ error: "no forwarder" }, { status: 403 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "bad request" }, { status: 400 });
  const b = parsed.data;

  // Ocean service without an FMC OTI number is a compliance flag, not a
  // hard block — noted for the owner, since some arrangements ride a
  // partner's license. Air + IATA same logic.
  const patch: Record<string, unknown> = {
    legal_name: b.legalName, dba: b.dba ?? null, address: b.address,
    ops_phone: b.opsPhone, after_hours_contact: b.afterHoursContact ?? null,
    scac_code: b.scacCode || null, iata_number: b.iataNumber || null,
    fmc_oti_number: b.fmcOtiNumber || null, customs_broker_license: b.customsBrokerLicense || null,
    services: b.services, origin_lanes: b.originLanes,
    insurance_carrier: b.insuranceCarrier || null,
    cargo_coverage_usd: b.cargoCoverageUsd ?? null,
    profile_completed_at: new Date().toISOString(),
  };
  if (b.wireDetails) {
    patch.wire_details_enc = b.wireDetails;      // encrypted-at-rest by DB; vault semantics
    patch.wire_change_pending = true;            // freezes payments pending voice confirm
  }

  const { error } = await sb.from("forwarders").update(patch).eq("id", prof.forwarder_id);
  if (error) return NextResponse.json({ error: "not permitted" }, { status: 403 });

  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: "forwarder", action: "forwarder.profile_updated",
    entity_table: "forwarders", entity_id: prof.forwarder_id,
    after: { services: b.services, banking_changed: !!b.wireDetails,
      compliance: { ocean_without_oti: b.services.includes("ocean") && !b.fmcOtiNumber,
                    air_without_iata: b.services.includes("air") && !b.iataNumber } },
  });
  return NextResponse.json({ ok: true, bankingFrozen: !!b.wireDetails });
}
