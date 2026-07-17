// Factory's side of a claim — firewalled: reaches Rob, never the client
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({ disputeId: z.string().uuid(), response: z.string().min(10).max(4000) });

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("factory_id, full_name").eq("id", user.id).single();
  if (!prof?.factory_id) return NextResponse.json({ error: "factory only" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  // RLS proves this dispute belongs to one of their runs
  const { data: d } = await sb.from("disputes").select("id, dispute_number").eq("id", parsed.data.disputeId).single();
  if (!d) return NextResponse.json({ error: "not found" }, { status: 404 });

  await sb.from("disputes").update({
    factory_response: parsed.data.response,
    factory_responded_at: new Date().toISOString(),
  }).eq("id", d.id);
  await sb.from("dispute_messages").insert({
    dispute_id: d.id, author_side: "factory", author_profile_id: user.id, body: parsed.data.response,
  });
  await sb.from("dispute_events").insert({
    dispute_id: d.id, actor_side: "factory", actor_profile_id: user.id, action: "responded",
  });
  await sb.from("tasks").insert({
    title: `🏭 Factory responded on ${d.dispute_number} — review their side`,
    kind: "dispute", related_id: d.id, auto_generated: true,
    due_on: new Date().toISOString().slice(0, 10),
  });
  return NextResponse.json({ ok: true, message: "Response recorded — SeshSure reviews and rules." });
}
