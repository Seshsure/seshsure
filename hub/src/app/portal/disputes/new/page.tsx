import { supabaseServer } from "@/lib/supabase-server";
import { DisputeForm } from "@/components/DisputeForm";

export const dynamic = "force-dynamic";

export default async function NewDispute() {
  const sb = supabaseServer();
  const { data: orders } = await sb.from("orders")
    .select("id, order_number, po_number").in("status", ["delivered", "shipped", "in_production"])
    .order("created_at", { ascending: false }).limit(12);
  return (
    <div className="max-w-lg mx-auto px-4 py-5">
      <h1 className="font-bold text-[16px]" style={{ color: "#15181A" }}>Report a problem</h1>
      <p className="text-[10px] mt-1" style={{ color: "#6E756B" }}>We take quality personally. Give us the picture and we&apos;ll move fast — acknowledgment within one business day.</p>
      <DisputeForm orders={(orders ?? []).map(o => ({ id: o.id, label: `${o.order_number ?? "Order"} · PO ${o.po_number}` }))} />
    </div>
  );
}
