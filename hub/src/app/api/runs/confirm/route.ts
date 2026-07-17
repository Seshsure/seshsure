import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({ runId: z.string().uuid(), promiseDate: z.string() });

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("factory_id, full_name").eq("id", user.id).single();
  if (!prof?.factory_id) return NextResponse.json({ error: "factory only" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  if (parsed.data.promiseDate < new Date().toISOString().slice(0, 10))
    return NextResponse.json({ error: "promise date can't be in the past" }, { status: 400 });

  const { data: run } = await sb.from("production_runs").select("id, status, promise_date").eq("id", parsed.data.runId).single();
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (run.status === "placed") {
    await sb.from("production_runs").update({
      status: "confirmed", promise_date: parsed.data.promiseDate, confirmed_at: new Date().toISOString(),
    }).eq("id", run.id);
  } else if (run.promise_date && run.promise_date !== parsed.data.promiseDate) {
    await sb.from("production_runs").update({
      promise_revision_pending: parsed.data.promiseDate,
    }).eq("id", run.id);
    await sb.from("tasks").insert({
      title: `⚠ Promise slip: run wants ${parsed.data.promiseDate} (was ${run.promise_date}) — acknowledge?`,
      kind: "promise_slip", related_id: run.id, auto_generated: true,
      due_on: new Date().toISOString().slice(0, 10),
    });
  }
  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: prof.full_name,
    action: "run.confirmed", entity_table: "production_runs", entity_id: run.id,
    after: { promise: parsed.data.promiseDate },
  });
  return NextResponse.json({ ok: true });
}
