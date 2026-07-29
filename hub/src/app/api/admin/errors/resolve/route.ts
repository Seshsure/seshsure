// ————— RESOLVE ERROR SIGNATURE — internal only, RLS-enforced —————
// Runs under the user's session: error_log's internal-only policy means a
// non-internal caller's update matches zero rows. Resolves every occurrence
// of the signature so the group closes as one.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({ signature: z.string().min(8).max(120) });

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const { data, error } = await sb.from("error_log")
    .update({ resolved_at: new Date().toISOString(), resolved_by: user.id })
    .eq("signature", parsed.data.signature).is("resolved_at", null).select("id");
  if (error) return NextResponse.json({ error: "not permitted" }, { status: 403 });

  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: "internal", action: "error.resolved",
    entity_table: "error_log", after: { signature: parsed.data.signature, count: data?.length ?? 0 },
  });
  return NextResponse.json({ ok: true, resolved: data?.length ?? 0 });
}
