import { supabaseServer } from "@/lib/supabase-server";
import { formatUSD } from "@/lib/money";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PortalHome() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: prof } = await sb.from("profiles").select("client_id, full_name").eq("id", user!.id).single();
  const { data: invoices } = await sb.from("invoices")
    .select("total_cents, paid_cents, status, due_date")
    .in("status", ["sent","viewed","partially_paid","overdue"]);
  const open = (invoices ?? []).reduce((s, i) => s + BigInt(i.total_cents) - BigInt(i.paid_cents), 0n);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = (invoices ?? []).filter(i => i.due_date && i.due_date < today).length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-[17px] font-bold" style={{ color: "#181818" }}>
        Welcome back{prof?.full_name ? `, ${prof.full_name.split(" ")[0]}` : ""}
      </h1>
      <div className="grid grid-cols-2 gap-3 mt-4">
        <Link href="/portal/invoices" className="rounded-xl border p-4" style={{ background: "#fff", borderColor: "#E7DFCE" }}>
          <p className="font-mono text-[10px] font-bold" style={{ color: "#3E3A30" }}>OPEN BALANCE</p>
          <p className="font-mono text-[18px] font-bold mt-1" style={{ color: overdue ? "#D62839" : "#181818" }}>{formatUSD(open)}</p>
          {overdue > 0 && <p className="font-mono text-[10px] mt-1" style={{ color: "#D62839" }}>{overdue} OVERDUE</p>}
        </Link>
        <Link href="/portal/orders/new" className="rounded-xl border p-4 flex flex-col justify-center items-center" style={{ background: "#181818", borderColor: "#181818" }}>
          <p className="text-[16px] font-bold" style={{ color: "#fff" }}>+ New order</p>
        </Link>
      </div>
    </div>
  );
}
