// ————— PRINT FILE — the converter's projection of the registry —————
// GET ?runId=…&format=summary|csv
// Verifies the caller is a member of the run's converter (or internal),
// then serves EXACTLY what printing needs: sequence, roll, pack, position,
// word, code — and a per-word count summary. tier and is_golden are never
// selected; the projection is the security boundary, enforced at the query.
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get("runId") ?? "";
  const format = req.nextUrl.searchParams.get("format") ?? "summary";
  if (!/^[0-9a-f-]{36}$/.test(runId)) return NextResponse.json({ error: "bad run" }, { status: 400 });

  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: me } = await sb.from("profiles").select("role, converter_id").eq("id", user.id).single();

  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: run } = await svc.from("arcade_print_runs").select("id, run_number, order_id, converter_id, total_peels").eq("id", runId).single();
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });
  const internal = me?.role === "owner" || me?.role === "staff";
  if (!internal && !(me?.role === "converter_admin" && me.converter_id === run.converter_id))
    return NextResponse.json({ error: "not permitted" }, { status: 403 });

  if (format === "summary") {
    // Per-word counts + roll layout. No tiers, ever.
    const { data } = await svc.from("arcade_registry")
      .select("word").eq("order_id", run.order_id).order("seq");
    const counts = new Map<string, number>();
    for (const r of data ?? []) counts.set(r.word, (counts.get(r.word) ?? 0) + 1);
    const words = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([word, count]) => ({ word, count }));
    return NextResponse.json({
      run: run.run_number, totalPeels: run.total_peels,
      rolls: Math.ceil(run.total_peels / 800), peelsPerRoll: 800, words,
    });
  }

  if (format === "csv") {
    // Full sequenced manifest — the file they print from.
    const { data } = await svc.from("arcade_registry")
      .select("seq, roll_no, pack_no, pos_in_pack, word, code")
      .eq("order_id", run.order_id).order("seq");
    if (!data?.length) return NextResponse.json({ error: "registry not generated" }, { status: 404 });
    const csv = "seq,roll,pack,pos,word,code\n" +
      data.map(r => `${r.seq},${r.roll_no},${r.pack_no},${r.pos_in_pack},${r.word},${r.code}`).join("\n");
    await svc.from("activity_log").insert({
      actor_profile_id: user.id, actor_label: internal ? "internal" : "converter",
      action: "arcade.printfile.downloaded", entity_table: "arcade_print_runs", entity_id: runId,
      after: { run_number: run.run_number, rows: data.length },
    });
    return new NextResponse(csv, { headers: {
      "content-type": "text/csv",
      "content-disposition": `attachment; filename="${run.run_number}-printfile.csv"`,
    } });
  }

  return NextResponse.json({ error: "format must be summary or csv" }, { status: 400 });
}
