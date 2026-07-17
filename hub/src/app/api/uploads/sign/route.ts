// ————— SIGNED UPLOAD URLS: browser → storage DIRECT —————
// Big art files and dispute videos never pass through the server (Vercel's 4.5MB
// request cap makes proxying impossible anyway). Server validates, issues a
// one-time signed URL scoped to the client's own folder; browser PUTs straight up.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const LIMITS: Record<string, { types: string[]; maxBytes: number }> = {
  art: {
    types: ["image/png", "image/jpeg", "image/svg+xml", "application/pdf", "application/postscript"],
    maxBytes: 50 * 1024 * 1024,
  },
  "dispute-media": {
    types: ["image/png", "image/jpeg", "image/heic", "video/mp4", "video/quicktime"],
    maxBytes: 100 * 1024 * 1024,
  },
};

const Body = z.object({
  bucket: z.enum(["art", "dispute-media"]),
  filename: z.string().min(1).max(180),
  contentType: z.string(),
  sizeBytes: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("client_id, role").eq("id", user.id).single();
  if (!prof?.client_id && prof?.role !== "owner")
    return NextResponse.json({ error: "client account required" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const b = parsed.data;

  const limit = LIMITS[b.bucket];
  if (!limit.types.includes(b.contentType))
    return NextResponse.json({ error: `file type not accepted — allowed: ${limit.types.join(", ")}` }, { status: 415 });
  if (b.sizeBytes > limit.maxBytes)
    return NextResponse.json({ error: `file too large — max ${Math.round(limit.maxBytes / 1048576)}MB` }, { status: 413 });

  // path lives inside the caller's own client folder — the storage RLS wall
  const safe = b.filename.replace(/[^\w.\-]/g, "_").slice(-120);
  const path = `${prof.client_id ?? "internal"}/${Date.now()}-${safe}`;

  const { data, error } = await sb.storage.from(b.bucket).createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: error?.message ?? "sign failed" }, { status: 500 });

  return NextResponse.json({ ok: true, path, token: data.token, signedUrl: data.signedUrl });
}
