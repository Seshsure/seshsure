// ————— CLIENT HOME — their account at a glance —————
import { supabaseServer } from "@/lib/supabase-server";
import { formatUSD } from "@/lib/money";
import Link from "next/link";
export const dynamic = "force-dynamic";

export default async function PortalHome() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: prof } = await sb.from("profiles").select("client_id, full_name").eq("id", user!.id).single();

  const [{ data: invoices }, { data: orders }, { data: disputes }, { data: shipments }] = await Promise.all([
    sb.from("invoices").select("total_cents, paid_cents, status, due_date").in("status", ["sent","viewed","partially_paid","overdue"]),
    sb.from("orders").select("id, status").not("status", "in", '("delivered","cancelled","expired")'),
    sb.from("disputes").select("id, status").not("status", "in", '("resolved","denied")'),
    sb.from("shipments").select("id, eta").is("delivered_at", null),
  ]);

  const open = (invoices ?? []).reduce((s, i) => s + BigInt(i.total_cents) - BigInt(i.paid_cents), 0n);
  const today = new Date().toISOString().slice(0, 10);
  const overdueN = (invoices ?? []).filter(i => i.due_date && i.due_date < today).length;
  const nextDue = (invoices ?? []).filter(i => i.due_date && i.due_date >= today)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))[0];
  const nextEta = (shipments ?? []).map(s => s.eta).filter(Boolean).sort()[0];

  const Tile = ({ label, value, hint, tone, href }: { label: string; value: string; hint?: string; tone?: string; href: string }) => (
    <Link href={href} className="rounded-xl border-2 bg-white p-4 block" style={{ borderColor: "#181818" }}>
      <p className="eyebrow" style={{ color: "#5C574A" }}>{label}</p>
      <p className="font-mono text-[18px] font-bold mt-1" style={{ color: tone ?? "#181818" }}>{value}</p>
      {hint && <p className="font-mono text-[10px] mt-1" style={{ color: "#5C574A" }}>{hint}</p>}
    </Link>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-[17px] font-bold" style={{ color: "#181818" }}>
        Welcome back{prof?.full_name ? `, ${prof.full_name.split(" ")[0]}` : ""}
      </h1>
      <div className="grid grid-cols-2 gap-3 mt-4">
        <Tile label="OPEN BALANCE" value={formatUSD(open)} tone={overdueN ? "#D62839" : "#181818"}
          hint={overdueN ? `${overdueN} OVERDUE` : "ALL CURRENT"} href="/portal/invoices" />
        <Tile label="NEXT PAYMENT DUE" value={nextDue?.due_date ?? "—"}
          hint={nextDue ? formatUSD(BigInt(nextDue.total_cents) - BigInt(nextDue.paid_cents)) : "NOTHING SCHEDULED"} href="/portal/money" />
        <Tile label="ORDERS IN FLIGHT" value={String((orders ?? []).length)} href="/portal/tracking" />
        <Tile label="NEXT DELIVERY ETA" value={nextEta ?? "—"} href="/portal/tracking" />
        <Tile label="OPEN CLAIMS" value={String((disputes ?? []).length)} tone={(disputes ?? []).length ? "#C77800" : "#0D9488"} href="/portal/disputes" />
        <Link href="/portal/orders/new" className="rounded-xl punch p-4 flex flex-col justify-center items-center" style={{ background: "#181818" }}>
          <p className="text-[16px] font-bold" style={{ color: "#fff" }}>+ New order</p>
        </Link>
      </div>
    </div>
  );
}
