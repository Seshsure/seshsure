// ————— PACKING LIST AUTO-READ — upload the PDF, the hub does the typing —————
// Factory uploads their packing list; we hand it to Claude, extract cartons /
// gross weight / dims / units as strict JSON, and pre-fill the confirm form.
// The factory still confirms — extraction assists, the declaration stays theirs.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

const Body = z.object({ storagePath: z.string().min(3) });

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("factory_id, role").eq("id", user.id).single();
  if (!prof?.factory_id && prof?.role !== "owner")
    return NextResponse.json({ error: "factory account required" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { storagePath } = parsed.data;

  // the file must live in the caller's own folder — the wall holds here too
  if (prof.factory_id && !storagePath.startsWith(`${prof.factory_id}/`))
    return NextResponse.json({ error: "not your file" }, { status: 403 });

  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ error: "auto-read not configured — enter the numbers manually" }, { status: 503 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } });
  const { data: file, error: dlErr } = await admin.storage.from("factory-docs").download(storagePath);
  if (dlErr || !file) return NextResponse.json({ error: "file not found" }, { status: 404 });

  const buf = Buffer.from(await file.arrayBuffer());
  const isPdf = storagePath.toLowerCase().endsWith(".pdf");
  const mediaType = isPdf ? "application/pdf" : storagePath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";

  const content: unknown[] = [
    isPdf
      ? { type: "document", source: { type: "base64", media_type: mediaType, data: buf.toString("base64") } }
      : { type: "image", source: { type: "base64", media_type: mediaType, data: buf.toString("base64") } },
    { type: "text", text:
`Extract shipping data from this packing list. Respond with ONLY a JSON object, no markdown fences, no commentary:
{"cartons": <total carton/box count as integer>, "gross_kg": <total gross weight in kg as number>, "net_kg": <total net weight in kg as number or null>, "carton_dims": "<carton dimensions as stated, e.g. 60x40x40 cm, or null>", "units": <total piece/unit count as integer or null>, "confidence": "<high|medium|low>", "notes": "<one short line on anything ambiguous, or null>"}
If weights are in lbs convert to kg. If multiple carton sizes exist, put the dominant size in carton_dims and mention the rest in notes.` },
  ];

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 400, messages: [{ role: "user", content }] }),
  });
  if (!resp.ok) return NextResponse.json({ error: "auto-read failed — enter manually" }, { status: 502 });
  const data = await resp.json();
  const text = (data.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
  try {
    const j = JSON.parse(text.replace(/```json|```/g, "").trim());
    await sb.from("activity_log").insert({
      actor_profile_id: user.id, actor_label: "factory", action: "run.packing_autoread",
      entity_table: "storage", after: { path: storagePath, extracted: j },
    });
    return NextResponse.json({ ok: true, extracted: j });
  } catch {
    return NextResponse.json({ error: "couldn't read the document cleanly — enter manually" }, { status: 422 });
  }
}
