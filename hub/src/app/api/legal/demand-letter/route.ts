// Owner reviews + approves the drafted demand letter (edit text, choose channel)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({
  letterId: z.string().uuid(),
  action: z.enum(["approve_send", "withdraw"]),
  finalText: z.string().min(100).optional(),
  sentVia: z.enum(["email", "certified_mail", "both"]).optional(),
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

  const { data: letter } = await sb.from("demand_letters")
    .select("id, client_id, status, total_demanded_cents").eq("id", b.letterId).single();
  if (!letter) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (letter.status !== "draft") return NextResponse.json({ error: `letter is ${letter.status}` }, { status: 400 });

  if (b.action === "withdraw") {
    await sb.from("demand_letters").update({ status: "withdrawn" }).eq("id", letter.id);
    return NextResponse.json({ ok: true });
  }

  await sb.from("demand_letters").update({
    status: "approved_sent",
    draft_text: b.finalText ?? undefined,
    approved_by: user.id, sent_at: new Date().toISOString(),
    sent_via: b.sentVia ?? "email",
  }).eq("id", letter.id);

  if ((b.sentVia ?? "email") !== "certified_mail") {
    await sb.from("notification_log").insert({
      recipient: "client-ap", template_key: "demand.letter", related_id: letter.id,
      subject: "Formal demand for payment — SeshSure",
    });
  }
  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: prof.full_name,
    action: "legal.demand_sent", entity_table: "demand_letters", entity_id: letter.id,
    client_id: letter.client_id,
    after: { total_cents: letter.total_demanded_cents, via: b.sentVia ?? "email" },
  });
  return NextResponse.json({ ok: true, note: b.sentVia !== "email" ? "Certified-mail copy: print from the letter view, mail from the Parker post office, keep the green card." : undefined });
}
