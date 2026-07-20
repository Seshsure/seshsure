// Factory-side onboarding: sign terms + acknowledge spec (payment terms & rate card are owner steps)
import { supabaseServer } from "@/lib/supabase-server";
import { FactoryOnboardWizard } from "@/components/FactoryOnboardWizard";

export const dynamic = "force-dynamic";

export default async function FactoryOnboarding() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: prof } = await sb.from("profiles").select("factory_id").eq("id", user!.id).single();
  const factoryId = prof!.factory_id!;

  const [{ data: sigs }, { data: acks }, { data: agreements }, { data: specs }] = await Promise.all([
    sb.from("signatures").select("id").eq("factory_id", factoryId).limit(1),
    sb.from("spec_acknowledgments").select("id").eq("factory_id", factoryId).limit(1),
    sb.from("agreement_versions").select("doc_key, version").in("doc_key", ["factory_nda", "factory_non_circumvention", "factory_services"]).order("version", { ascending: false }),
    sb.from("product_specs").select("id, title, version").order("version", { ascending: false }).limit(5),
  ]);

  const docKeys = [...new Set((agreements ?? []).map(a => a.doc_key))];

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="font-bold text-[17px]" style={{ color: "#181818" }}>Partner setup</h1>
      <p className="text-[11px] mt-1" style={{ color: "#514C41" }}>Two steps on your side. Payment terms and rates are set with SeshSure directly.</p>
      <FactoryOnboardWizard
        factoryId={factoryId}
        termsDone={(sigs?.length ?? 0) > 0}
        specDone={(acks?.length ?? 0) > 0}
        docKeys={docKeys.length ? docKeys : ["factory_nda", "factory_non_circumvention"]}
        specs={(specs ?? []).map(s => ({ id: s.id, title: s.title, version: s.version }))}
      />
    </div>
  );
}
