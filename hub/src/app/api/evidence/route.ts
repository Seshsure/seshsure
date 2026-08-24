// ————— EVIDENCE API — photos become records, records become viewable —————
// POST: after uploading to the evidence bucket, callers record the photo
// against a shipment (forwarder POD/damage) or run (factory QC). Membership
// validated: forwarders only on shipments awarded to them, factories only
// on their own runs. Owner can record anything.
// GET ?table=&id=: returns signed view URLs (1h) for photos the caller is
// allowed to see — RLS does the deciding via the user client.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

const Body = z.object({
  kind: z.enum(["pod", "qc", "damage", "other"]),
  entityTable: z.enum(["shipments", "production_runs"]),
  entityId: z.string().uuid(),
  storagePath: z.string().min(3).max(300),
  caption: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: me } = await sb.from("profiles").select("role, factory_id, forwarder_id").eq("id", user.id).single();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const b = parsed.data;
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  let factory_id: string | null = null, forwarder_id: string | null = null;

  if (me?.role === "owner" || me?.role === "staff") {
    // internal: record anywhere; tag ownership from the entity for org visibility
    if (b.entityTable === "shipments") {
      const { data: sh } = await svc.from("shipments").select("forwarder_id").eq("id", b.entityId).single();
      forwarder_id = sh?.forwarder_id ?? null;
    } else {
      const { data: run } = await svc.from("production_runs").select("factory_id").eq("id", b.entityId).single();
      factory_id = run?.factory_id ?? null;
    }
  } else if (me?.forwarder_id && b.entityTable === "shipments") {
    const { data: sh } = await svc.from("shipments").select("id, forwarder_id").eq("id", b.entityId).single();
    if (!sh || sh.forwarder_id !== me.forwarder_id)
      return NextResponse.json({ error: "not your shipment" }, { status: 403 });
    forwarder_id = me.forwarder_id;
    if (b.kind === "qc") return NextResponse.json({ error: "QC photos are factory-side" }, { status: 400 });
  } else if (me?.factory_id && b.entityTable === "production_runs") {
    const { data: run } = await svc.from("production_runs").select("id, factory_id").eq("id", b.entityId).single();
    if (!run || run.factory_id !== me.factory_id)
      return NextResponse.json({ error: "not your run" }, { status: 403 });
    factory_id = me.factory_id;
    if (b.kind === "pod") return NextResponse.json({ error: "POD photos are forwarder-side" }, { status: 400 });
  } else {
    return NextResponse.json({ error: "no evidence rights on this entity" }, { status: 403 });
  }

  const { error } = await svc.from("evidence_photos").insert({
    kind: b.kind, entity_table: b.entityTable, entity_id: b.entityId,
    storage_path: b.storagePath, caption: b.caption ?? null,
    uploaded_by: user.id, factory_id, forwarder_id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await svc.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: me?.role ?? "?", action: `evidence.${b.kind}.added`,
    entity_table: b.entityTable, entity_id: b.entityId, after: { path: b.storagePath },
  });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const table = req.nextUrl.searchParams.get("table") ?? "";
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!["shipments", "production_runs"].includes(table) || !id)
    return NextResponse.json({ error: "bad request" }, { status: 400 });

  // RLS decides visibility — the user client only returns what they may see.
  const { data: photos } = await sb.from("evidence_photos")
    .select("id, kind, storage_path, caption, created_at")
    .eq("entity_table", table).eq("entity_id", id).order("created_at");
  if (!photos?.length) return NextResponse.json({ photos: [] });

  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const out = [];
  for (const p of photos) {
    const { data: signed } = await svc.storage.from("evidence").createSignedUrl(p.storage_path, 3600);
    out.push({ id: p.id, kind: p.kind, caption: p.caption, at: p.created_at, url: signed?.signedUrl ?? null });
  }
  return NextResponse.json({ photos: out });
}
