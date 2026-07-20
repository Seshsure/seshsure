// ————— THE MIDDLE — our invoices vs factory invoices, month by month —————
import { supabaseServer } from "@/lib/supabase-server";
import { formatUSD } from "@/lib/money";
import { FactoryInvoiceEntry } from "@/components/FactoryInvoiceEntry";

export const dynamic = "force-dynamic";

export default async function Middle() {
  const sb = supabaseServer();
  const start = new Date(); start.setMonth(start.getMonth() - 11); start.setDate(1);

  const [{ data: ours }, { data: theirs }, { data: freight }, { data: factories }] = await Promise.all([
    sb.from("invoices").select("total_cents, sent_at").gte("sent_at", start.toISOString())
      .in("status", ["sent","viewed","partially_paid","paid","overdue"]),
    sb.from("factory_invoices").select("amount_cents, submitted_at").gte("submitted_at", start.toISOString()),
    sb.from("freight_rfqs").select("awarded_at, awarded_forwarder_id, freight_bids(all_in_cents, forwarder_id)")
      .not("awarded_at", "is", null).gte("awarded_at", start.toISOString()),
    sb.from("factories").select("id, name").eq("is_active", true),
  ]);

  const key = (d: string) => d.slice(0, 7); // YYYY-MM
  const months = new Map<string, { in_: bigint; factory: bigint; freight: bigint }>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(start); d.setMonth(d.getMonth() + i);
    months.set(d.toISOString().slice(0, 7), { in_: 0n, factory: 0n, freight: 0n });
  }
  for (const o of ours ?? []) { const m = months.get(key(o.sent_at)); if (m) m.in_ += BigInt(o.total_cents); }
  for (const t of theirs ?? []) { const m = months.get(key(t.submitted_at)); if (m) m.factory += BigInt(t.amount_cents); }
  type FR = { awarded_at: string; awarded_forwarder_id: string; freight_bids: { all_in_cents: number; forwarder_id: string }[] };
  for (const r of (freight ?? []) as unknown as FR[]) {
    const win = (r.freight_bids ?? []).find(b => b.forwarder_id === r.awarded_forwarder_id);
    const m = months.get(key(r.awarded_at));
    if (m && win) m.freight += BigInt(win.all_in_cents);
  }

  const rows = [...months.entries()].reverse();
  const tot = rows.reduce((a, [, v]) => ({ in_: a.in_ + v.in_, factory: a.factory + v.factory, freight: a.freight + v.freight }),
    { in_: 0n, factory: 0n, freight: 0n });
  const totMiddle = tot.in_ - tot.factory - tot.freight;
  const pct = tot.in_ > 0n ? Number((totMiddle * 1000n) / tot.in_) / 10 : null;

  return (
    <div className="max-w-5xl mx-auto px-4 pb-8">
      <div className="flex items-center justify-between mt-4">
        <div>
          <h1 className="display text-[19px]" style={{ color: "#181818" }}>THE MIDDLE</h1>
          <p className="text-[13px] mt-0.5" style={{ color: "#3E3A30" }}>What clients owe us − what we owe the factory − freight = the business.</p>
        </div>
        <FactoryInvoiceEntry factories={factories ?? []} />
      </div>

      <div className="mt-4 rounded-lg punch p-4 grid grid-cols-4 gap-4" style={{ background: "#FFFFFF" }}>
        {[["IN — OUR INVOICES (12MO)", formatUSD(tot.in_), "#181818"],
          ["OUT — FACTORY", formatUSD(tot.factory), "#3E3A30"],
          ["OUT — FREIGHT (AWARDED)", formatUSD(tot.freight), "#3E3A30"],
          ["THE MIDDLE", `${formatUSD(totMiddle < 0n ? -totMiddle : totMiddle)}${totMiddle < 0n ? " ⚠" : ""}${pct !== null ? ` · ${pct}%` : ""}`, totMiddle >= 0n ? "#0D9488" : "#D62839"]]
          .map(([label, val, color]) => (
          <div key={label as string}>
            <span className="eyebrow" style={{ color: "#5C574A" }}>{label}</span>
            <p className="font-mono text-[16px] font-bold mt-1" style={{ color: color as string }}>{val}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg border overflow-hidden" style={{ background: "#FFFFFF", borderColor: "#E7DFCE" }}>
        <div className="grid grid-cols-5 px-4 py-2 border-b" style={{ borderColor: "#E7DFCE" }}>
          {["MONTH", "IN (OURS)", "FACTORY", "FREIGHT", "MIDDLE"].map(h => (
            <span key={h} className="eyebrow" style={{ color: "#5C574A" }}>{h}</span>
          ))}
        </div>
        {rows.map(([m, v]) => {
          const middle = v.in_ - v.factory - v.freight;
          const has = v.in_ > 0n || v.factory > 0n || v.freight > 0n;
          return (
            <div key={m} className="grid grid-cols-5 px-4 py-2.5 border-b last:border-0" style={{ borderColor: "#E7DFCE", opacity: has ? 1 : 0.45 }}>
              <span className="font-mono text-[12px] font-bold" style={{ color: "#181818" }}>{m}</span>
              <span className="font-mono text-[12px]" style={{ color: "#181818" }}>{v.in_ > 0n ? formatUSD(v.in_) : "—"}</span>
              <span className="font-mono text-[12px]" style={{ color: "#3E3A30" }}>{v.factory > 0n ? formatUSD(v.factory) : "—"}</span>
              <span className="font-mono text-[12px]" style={{ color: "#3E3A30" }}>{v.freight > 0n ? formatUSD(v.freight) : "—"}</span>
              <span className="font-mono text-[12px] font-bold" style={{ color: !has ? "#9B9484" : middle >= 0n ? "#0D9488" : "#D62839" }}>
                {has ? formatUSD(middle < 0n ? -middle : middle) : "—"}{has && middle < 0n ? " ⚠" : ""}
              </span>
            </div>
          );
        })}
      </div>

      <p className="font-mono text-[10px] mt-3 px-1 leading-relaxed" style={{ color: "#5C574A" }}>
        IN = INVOICES SENT THAT MONTH (BILLED, NOT COLLECTED). FACTORY = THEIR INVOICES BY DATE. FREIGHT = AWARDED BIDS.
        DUTY/TARIFF RIDES INSIDE FACTORY OR FREIGHT DEPENDING ON WHO BILLS IT — RECORD IT WHERE THE PAPER SAYS.
        MONTHS MISMATCH WHEN PRODUCTION LEADS SALES — THE 12-MONTH TOTAL IS THE HONEST NUMBER.
      </p>
    </div>
  );
}
