import { supabaseServer } from "@/lib/supabase-server";
import { OrderForm } from "@/components/OrderForm";

export const dynamic = "force-dynamic";

export default async function NewOrder() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: prof } = await sb.from("profiles").select("client_id").eq("id", user!.id).single();
  const [{ data: products }, { data: addresses }] = await Promise.all([
    sb.from("products").select("id, sku, description, is_flagship, is_orderable").eq("is_orderable", true),
    sb.from("client_addresses").select("id, label, address").eq("client_id", prof!.client_id!),
  ]);
  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      <h1 className="font-bold text-[16px] mb-3" style={{ color: "#15181A" }}>New order</h1>
      <OrderForm
        products={(products ?? []).filter(p => !p.is_flagship).map(p => ({ id: p.id, sku: p.sku, description: p.description }))}
        addresses={(addresses ?? []).map(a => ({ id: a.id, label: a.label }))}
      />
    </div>
  );
}
