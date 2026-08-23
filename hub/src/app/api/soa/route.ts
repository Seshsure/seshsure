// ————— LIVE SOA API — one statement, two signatures per line —————
// Owner adds entries (sign derived from kind — charges increase the
// payable, payments/credits decrease it; the API owns the sign so a typo
// can't flip the balance). Factory confirms or disputes lines through
// here ONLY — they have read-only RLS on the table, because a direct
// update policy would let amounts be altered. A fully-confirmed statement
// IS the reconciliation.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

const CHARGE_KINDS = ["charge_goods", "charge_services", "charge_freight", "adjustment_up"] as const;
const CREDIT_KINDS = ["payment", "credit", "adjustment_down"] as const;
const ENTITIES = ["ST Global Packs", "Solitude Flame"] as const;

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    factoryId: z.string().uuid(),
    kind: z.enum([...CHARGE_KINDS, ...CREDIT_KINDS]),
    billingEntity: z.enum(ENTITIES).optional(),
    refNo: z.string().max(60).optional(),
    description: z.string().min(3).max(300),
    amountCents: z.number().int().positive().max(100_000_000_00),
    entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    attachmentPath: z.string().max(300).optional(),
  }),
  z.object({
    action: z.literal("submit"),                    // factory submits a charge
    kind: z.enum(CHARGE_KINDS),
    billingEntity: z.enum(ENTITIES),
    refNo: z.string().min(1).max(60),
    description: z.string().min(3).max(300),
    amountCents: z.number().int().positive().max(100_000_000_00),
    entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    attachmentPath: z.string().min(3).max(300),     // doc REQUIRED on factory submissions
  }),
  z.object({ action: z.literal("approve"), lineId: z.string().uuid() }),
  z.object({ action: z.literal("reject"), lineId: z.string().uuid(), note: z.string().min(4).max(400) }),
  z.object({ action: z.literal("confirm"), lineId: z.string().uuid() }),
  z.object({ action: z.literal("dispute"), lineId: z.string().uuid(), note: z.string().min(4).max(400) }),
  z.object({ action: z.literal("remove"), lineId: z.string().uuid() }),   // owner, unconfirmed lines only
]);

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: me } = await sb.from("profiles").select("role, factory_id, full_name").eq("id", user.id).single();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "bad request" }, { status: 400 });
  const b = parsed.data;
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const cogsOf = (kind: string) =>
    kind === "charge_goods" ? "goods" : kind === "charge_services" ? "services" :
    kind === "charge_freight" ? "freight" : kind.startsWith("charge") ? "other" : null;

  // ————— FACTORY: submit a charge for owner approval —————
  if (b.action === "submit") {
    if (!me?.factory_id || !String(me.role).startsWith("factory"))
      return NextResponse.json({ error: "factory members only" }, { status: 403 });
    const { error } = await svc.from("factory_statement_lines").insert({
      factory_id: me.factory_id, kind: b.kind, billing_entity: b.billingEntity,
      ref_no: b.refNo, description: b.description, total_cents: b.amountCents,
      entry_date: b.entryDate, attachment_path: b.attachmentPath,
      status: "pending", submitted_by: user.id,
      factory_confirmed_at: new Date().toISOString(), factory_confirmed_by: user.id, // submitting IS their signature
      cogs_category: cogsOf(b.kind),
      company_label: b.billingEntity, quantity: 0, rate_per_cone_microcents: 0, fees_cents: 0,
      added_by: user.id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await svc.from("activity_log").insert({
      actor_profile_id: user.id, actor_label: "factory", action: "soa.submitted",
      entity_table: "factory_statement_lines",
      after: { kind: b.kind, amount: b.amountCents, ref: b.refNo, entity: b.billingEntity },
    });
    return NextResponse.json({ ok: true, note: "Submitted — appears in the statement once SeshSure approves." });
  }

  // ————— OWNER: approve / reject factory submissions —————
  if (b.action === "approve" || b.action === "reject") {
    if (me?.role !== "owner") return NextResponse.json({ error: "owner only" }, { status: 403 });
    const { data: line } = await svc.from("factory_statement_lines")
      .select("id, status").eq("id", b.lineId).single();
    if (!line || line.status !== "pending") return NextResponse.json({ error: "not a pending line" }, { status: 400 });
    if (b.action === "approve") {
      await svc.from("factory_statement_lines").update({
        status: "live", owner_approved_at: new Date().toISOString(),
      }).eq("id", b.lineId);
    } else {
      await svc.from("factory_statement_lines").update({
        status: "rejected", reject_note: b.note,
      }).eq("id", b.lineId);
    }
    await svc.from("activity_log").insert({
      actor_profile_id: user.id, actor_label: "owner", action: `soa.${b.action}d`,
      entity_table: "factory_statement_lines", entity_id: b.lineId,
      after: b.action === "reject" ? { note: b.note } : {},
    });
    return NextResponse.json({ ok: true });
  }

  // ————— OWNER: add / remove —————
  if (b.action === "add" || b.action === "remove") {
    if (me?.role !== "owner") return NextResponse.json({ error: "owner only" }, { status: 403 });

    if (b.action === "add") {
      const isCharge = (CHARGE_KINDS as readonly string[]).includes(b.kind);
      const signed = isCharge ? b.amountCents : -b.amountCents;
      if (isCharge && b.kind !== "adjustment_up" && !b.billingEntity)
        return NextResponse.json({ error: "charges need a billing entity (ST Global Packs / Solitude Flame)" }, { status: 400 });
      const { error } = await svc.from("factory_statement_lines").insert({
        factory_id: b.factoryId, kind: b.kind, billing_entity: b.billingEntity ?? null,
        ref_no: b.refNo ?? null, description: b.description, total_cents: signed,
        entry_date: b.entryDate, attachment_path: b.attachmentPath ?? null,
        company_label: b.billingEntity ?? "—", quantity: 0, rate_per_cone_microcents: 0, fees_cents: 0,
        cogs_category: cogsOf(b.kind), added_by: user.id,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    } else {
      const { data: line } = await svc.from("factory_statement_lines")
        .select("id, factory_confirmed_at, kind").eq("id", b.lineId).single();
      if (!line) return NextResponse.json({ error: "not found" }, { status: 404 });
      if (line.factory_confirmed_at)
        return NextResponse.json({ error: "line is factory-confirmed — reverse with an adjustment, never delete agreed history" }, { status: 400 });
      if (line.kind === "opening_balance")
        return NextResponse.json({ error: "opening balance is the anchor — adjust, don't delete" }, { status: 400 });
      await svc.from("factory_statement_lines").delete().eq("id", b.lineId);
    }
    await svc.from("activity_log").insert({
      actor_profile_id: user.id, actor_label: "owner", action: `soa.${b.action}`,
      entity_table: "factory_statement_lines",
      after: b.action === "add" ? { kind: b.kind, amount: b.amountCents, entity: b.billingEntity ?? null } : { lineId: b.lineId },
    });
    return NextResponse.json({ ok: true });
  }

  // ————— FACTORY: confirm / dispute (their factory's lines only) —————
  if (!me?.factory_id || !String(me.role).startsWith("factory"))
    return NextResponse.json({ error: "factory members only" }, { status: 403 });
  const { data: line } = await svc.from("factory_statement_lines")
    .select("id, factory_id, factory_confirmed_at").eq("id", b.lineId).single();
  if (!line || line.factory_id !== me.factory_id) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (b.action === "confirm") {
    if (line.factory_confirmed_at) return NextResponse.json({ ok: true });
    await svc.from("factory_statement_lines").update({
      factory_confirmed_at: new Date().toISOString(), factory_confirmed_by: user.id, dispute_note: null,
    }).eq("id", b.lineId);
  } else {
    await svc.from("factory_statement_lines").update({
      dispute_note: b.note, factory_confirmed_at: null, factory_confirmed_by: null,
    }).eq("id", b.lineId);
  }
  await svc.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: "factory", action: `soa.${b.action}ed`,
    entity_table: "factory_statement_lines", entity_id: b.lineId,
    after: b.action === "dispute" ? { note: b.note } : {},
  });
  return NextResponse.json({ ok: true });
}
