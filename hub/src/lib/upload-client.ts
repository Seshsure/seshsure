"use client";
// Browser-side helper: sign → direct upload → return storage path
import { supabaseBrowser } from "./supabase-browser";

export async function uploadDirect(bucket: "art" | "dispute-media", file: File):
  Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const signRes = await fetch("/api/uploads/sign", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ bucket, filename: file.name, contentType: file.type, sizeBytes: file.size }),
  });
  const sign = await signRes.json();
  if (!signRes.ok) return { ok: false, error: sign.error ?? "sign failed" };

  const sb = supabaseBrowser();
  const { error } = await sb.storage.from(bucket).uploadToSignedUrl(sign.path, sign.token, file, { contentType: file.type });
  if (error) return { ok: false, error: error.message };
  return { ok: true, path: sign.path };
}
