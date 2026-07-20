import { supabaseServer } from "@/lib/supabase-server";
import { MoneySettings } from "@/components/MoneySettings";

export const dynamic = "force-dynamic";

export default async function Money() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: prof } = await sb.from("profiles").select("client_id").eq("id", user!.id).single();
  const [{ data: client }, { data: bank }, { data: entity }] = await Promise.all([
    sb.from("clients").select("accepted_methods, preferred_method").eq("id", prof!.client_id!).single(),
    sb.from("client_bank_accounts").select("account_last4, micro_verified").eq("client_id", prof!.client_id!).eq("is_active", true).maybeSingle(),
    sb.from("entities").select("checks_payable_to, remit_check_address, wire_instructions").eq("is_default", true).single(),
  ]);
  return (
    <div className="max-w-3xl mx-auto px-4 py-5">
      <h1 className="font-bold text-[16px] mb-3" style={{ color: "#181818" }}>Money</h1>
      <MoneySettings
        accepted={client?.accepted_methods ?? ["ach"]}
        preferred={client?.preferred_method ?? "ach"}
        bankLast4={bank?.account_last4 ?? null}
        bankVerified={bank?.micro_verified ?? false}
        checksPayableTo={entity?.checks_payable_to ?? ""}
        remitAddress={entity?.remit_check_address ?? ""}
      />
    </div>
  );
}
