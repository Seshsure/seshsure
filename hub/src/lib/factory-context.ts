import type { SupabaseClient } from "@supabase/supabase-js";

// Resolves which factory the current session operates as.
// Factory roles → their own. Owner → first factory, flagged as preview.
export async function resolveFactory(sb: SupabaseClient, userId: string) {
  const { data: prof } = await sb.from("profiles").select("factory_id, role").eq("id", userId).single();
  if (prof?.factory_id) return { factoryId: prof.factory_id as string, preview: false };
  if (prof?.role === "owner") {
    const { data: f } = await sb.from("factories").select("id").order("created_at").limit(1).single();
    if (f) return { factoryId: f.id as string, preview: true };
  }
  return { factoryId: null, preview: false };
}
