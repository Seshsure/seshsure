import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({
  runId: z.string().uuid().optional(),
  mode: z.enum(["sea","air"]),
  cargo: z.object({
    cartons: z.number().int().positive(),
    weightKg: z.number().positive(),
    originPort: z.string(),
    destination: z.string(),
  }),
  bidDeadline: z.string().optional(),
  forwarderIds: z.array(z.string().uuid()).min(1),
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

  const { data: rfq, error } = await sb.from("freight_rfqs").insert({
    run_id: b.runId ?? null, mode: b.mode, cargo_summary: b.cargo,
    bid_deadline: b.bidDeadline ?? null, created_by: user.id,
  }).select("id").single();
  if (error || !rfq) return NextResponse.json({ error: error?.message }, { status: 500 });

  for (let i = 0; i < b.forwarderIds.length; i++) {
    await sb.from("notification_log").insert({
      recipient: "forwarder", template_key: "freight.rfq", related_id: rfq.id,
      subject: `RFQ ${b.mode.toUpperCase()} — ${b.cargo.cartons} ctns, ${b.cargo.originPort} → ${b.cargo.destination}`,
    });
  }
  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: prof.full_name,
    action: "freight.rfq_opened", entity_table: "freight_rfqs", entity_id: rfq.id,
    after: { mode: b.mode, invited: b.forwarderIds.length },
  });
  const links: { forwarder: string; url: string }[] = [];
  for (const fid of b.forwarderIds ?? []) {
    const { data: l } = await sb.from("forwarder_quote_links").insert({ rfq_id: rfq.id, forwarder_id: fid }).select("token, forwarders:forwarder_id(name)").single();
    if (l) links.push({ forwarder: (l.forwarders as unknown as { name: string })?.name ?? "", url: `${process.env.HUB_URL ?? "https://hub.seshsure.com"}/quote/${l.token}` });
  }
  return NextResponse.json({ ok: true, links, rfqId: rfq.id });
}
