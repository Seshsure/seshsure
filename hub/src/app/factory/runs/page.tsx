import { supabaseServer } from "@/lib/supabase-server";
import { PickupDate } from "@/components/PickupDate";
import { RunDocs } from "@/components/RunDocs";
import { RunConfirm } from "@/components/RunConfirm";

export const dynamic = "force-dynamic";

export default async function Runs() {
  const sb = supabaseServer();
  const { data: runs } = await sb.from("production_runs")
    .select("id, run_number, status, promise_date, pickup_ready_date, run_documents(doc_type, filename), packing_cartons, packing_gross_kg, packing_dims_note, packing_list_path, created_at, run_orders(orders(order_number, clients(dba, legal_name), order_items(quantity, products(description))))")
    .not("status", "in", '("closed")').order("created_at", { ascending: false });

  return (
    <div className="max-w-3xl mx-auto px-4 py-5">
      <h1 className="font-bold text-[16px] mb-1" style={{ color: "#181818" }}>Production runs</h1>
      <p className="text-[12px] font-mono mb-3" style={{ color: "#3E3A30" }}>CONFIRM WITHIN 48H · PROMISE-DATE CHANGES REQUIRE SESHSURE ACKNOWLEDGMENT</p>
      <div className="rounded-xl border overflow-hidden" style={{ background: "#fff", borderColor: "#E7DFCE" }}>
        {(runs ?? []).map(r => {
          type RO = { orders: { order_number: string; clients: { dba: string|null; legal_name: string|null }; order_items: { quantity: number; products: { description: string } }[] } };
          const ros = (r.run_orders ?? []) as unknown as RO[];
          const qty = ros.flatMap(x => x.orders?.order_items ?? []).reduce((s, i) => s + Number(i.quantity), 0);
          const desc = ros.flatMap(x => x.orders?.order_items ?? []).map(i => i.products?.description)[0] ?? "";
          const hrs = Math.floor((Date.now() - new Date(r.created_at).getTime()) / 36e5);
          return (
            <div key={r.id} className="px-4 py-3 border-b" style={{ borderColor: "#E7DFCE" }}>
              <div className="flex items-center justify-between">
                <p className="font-mono text-[13px] font-bold" style={{ color: "#181818" }}>{r.run_number}</p>
                <span className="font-mono text-[10px] font-bold px-2 py-1 rounded" style={{
                  color: r.status === "placed" && hrs > 48 ? "#D62839" : "#0D9488", background: "#0D948810" }}>
                  {r.status === "placed" ? `AWAITING CONFIRMATION · ${hrs}H` : String(r.status).replace(/_/g," ").toUpperCase()}
                </span>
              </div>
              <p className="text-[12px] mt-1" style={{ color: "#3E3A30" }}>
                {qty.toLocaleString()} cones · {desc}
                {ros[0]?.orders?.clients ? ` · ${ros[0].orders.clients.dba ?? ros[0].orders.clients.legal_name}` : ""}
                {r.promise_date ? ` · PROMISE ${r.promise_date}` : ""}
              </p>
              {r.status === "placed" && <RunConfirm runId={r.id} />}
              {["confirmed","in_production","qc_submitted","qc_approved"].includes(String(r.status)) &&
                <PickupDate runId={r.id} current={r.pickup_ready_date} cartons={r.packing_cartons} grossKg={r.packing_gross_kg ? Number(r.packing_gross_kg) : null} dims={r.packing_dims_note} hasList={!!r.packing_list_path} />}
              {["confirmed","in_production","qc_submitted","qc_approved"].includes(String(r.status)) &&
                <RunDocs runId={r.id} existing={(r.run_documents as {doc_type:string;filename:string}[] | null) ?? []} />}
            </div>
          );
        })}
        {!runs?.length && <p className="px-4 py-6 text-[13px]" style={{ color: "#3E3A30" }}>No open runs.</p>}
      </div>
    </div>
  );
}
