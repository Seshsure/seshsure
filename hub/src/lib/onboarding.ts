// Onboarding: server-side state machine. Resumable, idempotent, audited.
import { supabaseServer } from "./supabase-server";

export const STEPS = ["company", "team", "shipping", "agreements", "payment"] as const;
export type Step = (typeof STEPS)[number];

export async function getOnboardingState() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: prof } = await sb.from("profiles")
    .select("client_id, full_name, email, role").eq("id", user.id).single();
  if (!prof?.client_id) return null;

  const [{ data: client }, { data: progress }, { data: addrs }, { data: team }] = await Promise.all([
    sb.from("clients").select("*").eq("id", prof.client_id).single(),
    sb.from("onboarding_progress").select("step, completed_at").eq("client_id", prof.client_id),
    sb.from("client_addresses").select("*").eq("client_id", prof.client_id),
    sb.from("profiles").select("full_name,email,role").eq("client_id", prof.client_id),
  ]);

  const done = new Set((progress ?? []).filter(p => p.completed_at).map(p => p.step));
  const next = STEPS.find(s => !done.has(s)) ?? "done";
  return { client, addrs: addrs ?? [], team: team ?? [], done: [...done], next, me: prof };
}

export async function completeStep(clientId: string, step: Step) {
  const sb = supabaseServer();
  await sb.from("onboarding_progress")
    .upsert({ client_id: clientId, step, completed_at: new Date().toISOString() }, { onConflict: "client_id,step" });
}
