// ————— RECORD A RUN DOCUMENT — factory (own runs, RLS) or owner —————
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({
  runId: z.string().uuid(),
  docType: z.enum(["commercial_invoice","packing_list","certificate_of_origin","vgm","ispm15","coa","other"]),
  filename: z.string().min(1), storagePath: z.string().min(3),
});

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const b = parsed.data;
  const { error } = await sb.from("run_documents").insert({
    run_id: b.runId, doc_type: b.docType, filename: b.filename, storage_path: b.storagePath, uploaded_by: user.id,
  });
  if (error) return NextResponse.json({ error: "not permitted" }, { status: 403 });
  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: "factory", action: `run.doc_uploaded.${b.docType}`,
    entity_table: "production_runs", entity_id: b.runId, after: { filename: b.filename },
  });
  return NextResponse.json({ ok: true });
}
