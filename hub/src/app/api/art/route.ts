// Register uploaded artwork: extracts print-readiness verdict from client-reported dimensions
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({
  storagePath: z.string().min(3),
  fileType: z.string(),
  brandId: z.string().uuid().optional(),
  label: z.string().max(120).optional(),
  widthPx: z.number().int().positive().optional(),
  heightPx: z.number().int().positive().optional(),
});

// wrap print area ≈ 45.7cm × 15.2cm arc → 300 DPI needs ~5400×1800px; vector formats always pass
const MIN_W = 5400, MIN_H = 1800;

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("client_id, full_name").eq("id", user.id).single();
  if (!prof?.client_id) return NextResponse.json({ error: "no client" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const b = parsed.data;

  if (!b.storagePath.startsWith(`${prof.client_id}/`))
    return NextResponse.json({ error: "path mismatch" }, { status: 403 });

  const vector = ["image/svg+xml", "application/pdf", "application/postscript"].includes(b.fileType);
  const printReady = vector || (!!b.widthPx && !!b.heightPx && b.widthPx >= MIN_W && b.heightPx >= MIN_H);
  const notes = vector ? "vector — scales to press resolution"
    : printReady ? `raster ${b.widthPx}×${b.heightPx}px — meets 300 DPI wrap target`
    : b.widthPx ? `raster ${b.widthPx}×${b.heightPx}px — BELOW 300 DPI wrap target (${MIN_W}×${MIN_H}px). Usable for preview; press file should be vector or higher-res.`
    : "dimensions unknown — press check pending";

  const { data: asset, error } = await sb.from("art_assets").insert({
    client_id: prof.client_id, brand_id: b.brandId ?? null,
    label: b.label ?? b.storagePath.split("/").pop(),
    storage_path: b.storagePath, file_type: b.fileType,
    width_px: b.widthPx ?? null, height_px: b.heightPx ?? null,
    print_ready: printReady, print_notes: notes,
    uploaded_by: user.id,
  }).select("id").single();
  if (error || !asset) return NextResponse.json({ error: error?.message }, { status: 500 });

  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: prof.full_name,
    action: "art.uploaded", entity_table: "art_assets", entity_id: asset.id, client_id: prof.client_id,
    after: { path: b.storagePath, print_ready: printReady },
  });
  return NextResponse.json({ ok: true, artAssetId: asset.id, printReady, notes });
}
