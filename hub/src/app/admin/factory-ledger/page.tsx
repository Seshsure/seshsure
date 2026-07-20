// Rob's live Excel-style mirror of the factory statement
import { supabaseServer } from "@/lib/supabase-server";
import { formatUSD, formatPerCone } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function FactoryLedger() {
  const sb = supabaseServer();
  const [{ data: lines }, { data: allLines }, { data: ourInvoices }] = await Promise.all([
    sb.from("factory_statement_lines").select("*, factories(name)").is("settled_at", null).order("created_at"),
    sb.from("factory_statement_lines").select("total_cents, created_at"),
    sb.from("invoices").select("total_cents, sent_at").in("status", ["sent","viewed","partially_paid","paid","overdue"]).not("sent_at", "is", null),
  ]);
  const total = (lines ?? []).reduce((s, l) => s + BigInt(l.total_cents), 0n);

  // ————— THE MIDDLE: money in vs money out, by month —————
  const mk = (d: string) => d.slice(0, 7);
  const months = new Map<string, { ours: bigint; theirs: bigint }>();
  for (const i of ourInvoices ?? []) {
    const m = mk(i.sent_at as string);
    const v = months.get(m) ?? { ours: 0n, theirs: 0n };
    v.ours += BigInt(i.total_cents); months.set(m, v);
  }
  for (const l of allLines ?? []) {
    const m = mk(l.created_at as string);
    const v = months.get(m) ?? { ours: 0n, theirs: 0n };
    v.theirs += BigInt(l.total_cents); months.set(m, v);
  }
  const monthRows = [...months.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
  const totOurs = monthRows.reduce((s2, [, v]) => s2 + v.ours, 0n);
  const totTheirs = monthRows.reduce((s2, [, v]) => s2 + v.theirs, 0n);

  return (
    <div className="max-w-3xl mx-auto px-4 pb-8">
      <div className="mt-4 flex items-center justify-between">
        <h1 className="text-[15px] font-bold" style={{ color: "#181818" }}>Factory statement — live mirror</h1>
        <span className="font-mono text-[10px] px-2 py-1 rounded border" style={{ color: "#3E3A30", borderColor: "#E7DFCE" }}>XLSX EXPORT</span>
      </div>
      <div className="mt-3 rounded-lg punch-sm overflow-hidden" style={{ background: "#FFFFFF" }}>
        <div className="px-3 py-2 border-b flex justify-between" style={{ borderColor: "#E7DFCE" }}>
          <span className="eyebrow" style={{ color: "#3E3A30" }}>THE MIDDLE — OUR INVOICES VS FACTORY BILLED (BY MONTH)</span>
          <span className="font-mono text-[12px] font-bold" style={{ color: totOurs - totTheirs >= 0n ? "#0D9488" : "#D62839" }}>
            12MO MIDDLE: {totOurs - totTheirs >= 0n ? "" : "-"}{formatUSD(totOurs - totTheirs < 0n ? totTheirs - totOurs : totOurs - totTheirs)}
          </span>
        </div>
        <table className="w-full font-mono text-[12px]" style={{ color: "#181818" }}>
          <thead><tr style={{ background: "#FAF5EA" }}>
            {["MONTH", "OUR INVOICES", "FACTORY BILLED", "THE MIDDLE"].map(h => (
              <th key={h} className="px-3 py-2 text-left border-b" style={{ borderColor: "#E7DFCE", color: "#3E3A30", fontSize: 10 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {monthRows.length === 0 && <tr><td colSpan={4} className="px-3 py-3 text-[12px]" style={{ color: "#5C574A" }}>Fills as invoices and factory statements land.</td></tr>}
            {monthRows.map(([m, v]) => {
              const mid = v.ours - v.theirs;
              return (
                <tr key={m}>
                  <td className="px-3 py-2 border-b" style={{ borderColor: "#E7DFCE", color: "#3E3A30" }}>{m}</td>
                  <td className="px-3 py-2 border-b" style={{ borderColor: "#E7DFCE" }}>{formatUSD(v.ours)}</td>
                  <td className="px-3 py-2 border-b" style={{ borderColor: "#E7DFCE" }}>{formatUSD(v.theirs)}</td>
                  <td className="px-3 py-2 border-b font-bold" style={{ borderColor: "#E7DFCE", color: mid >= 0n ? "#0D9488" : "#D62839" }}>
                    {mid >= 0n ? "" : "-"}{formatUSD(mid < 0n ? -mid : mid)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 rounded-lg border overflow-x-auto" style={{ background: "#FFFFFF", borderColor: "#E7DFCE" }}>
        <table className="w-full font-mono text-[12px]" style={{ color: "#181818" }}>
          <thead>
            <tr style={{ background: "#FAF5EA" }}>
              {["#","FACTORY","COMPANY","QTY","RATE/CONE","FEES","TOTAL","KIND","FLAG"].map(h => (
                <th key={h} className="px-2 py-2 text-left border-b border-r" style={{ borderColor: "#E7DFCE", color: "#3E3A30", fontSize: 8 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(lines ?? []).map((l, i) => (
              <tr key={l.id}>
                <td className="px-2 py-1.5 border-b border-r" style={{ borderColor: "#E7DFCE", color: "#5C574A" }}>{i + 1}</td>
                <td className="px-2 py-1.5 border-b border-r" style={{ borderColor: "#E7DFCE" }}>{(l.factories as unknown as {name:string})?.name}</td>
                <td className="px-2 py-1.5 border-b border-r" style={{ borderColor: "#E7DFCE" }}>{l.company_label}</td>
                <td className="px-2 py-1.5 border-b border-r text-right" style={{ borderColor: "#E7DFCE" }}>{Number(l.quantity).toLocaleString()}</td>
                <td className="px-2 py-1.5 border-b border-r text-right" style={{ borderColor: "#E7DFCE" }}>{formatPerCone(BigInt(l.rate_per_cone_microcents))}</td>
                <td className="px-2 py-1.5 border-b border-r text-right" style={{ borderColor: "#E7DFCE" }}>{formatUSD(BigInt(l.fees_cents))}</td>
                <td className="px-2 py-1.5 border-b border-r text-right font-bold" style={{ borderColor: "#E7DFCE" }}>{formatUSD(BigInt(l.total_cents))}</td>
                <td className="px-2 py-1.5 border-b border-r" style={{ borderColor: "#E7DFCE", color: "#3E3A30" }}>{l.kind.toUpperCase()}</td>
                <td className="px-2 py-1.5 border-b" style={{ borderColor: "#E7DFCE", color: "#C77800" }}>{l.discrepancy_flag ? `⚠ ${l.discrepancy_flag}` : ""}</td>
              </tr>
            ))}
            <tr style={{ background: "#FAF5EA" }}>
              <td colSpan={6} className="px-2 py-2 border-r text-right font-bold" style={{ borderColor: "#E7DFCE", color: "#3E3A30" }}>SUM</td>
              <td className="px-2 py-2 text-right font-bold" style={{ color: "#0D9488" }}>{formatUSD(total)}</td>
              <td colSpan={2}></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="font-mono text-[10px] mt-2 px-1" style={{ color: "#5C574A" }}>
        LINES APPEAR AS THE FACTORY ADDS THEM · RATE MISMATCHES VS AGREED BID FLAG AUTOMATICALLY + RAISE A TASK · SERVICES LINES FEED TRUE COGS
      </p>
    </div>
  );
}
