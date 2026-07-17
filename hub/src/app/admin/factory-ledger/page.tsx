// Rob's live Excel-style mirror of the factory statement
import { supabaseServer } from "@/lib/supabase-server";
import { formatUSD, formatPerCone } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function FactoryLedger() {
  const sb = supabaseServer();
  const { data: lines } = await sb.from("factory_statement_lines")
    .select("*, factories(name)").is("settled_at", null).order("created_at");
  const total = (lines ?? []).reduce((s, l) => s + BigInt(l.total_cents), 0n);

  return (
    <div className="max-w-3xl mx-auto px-4 pb-8">
      <div className="mt-4 flex items-center justify-between">
        <h1 className="text-[13px] font-bold" style={{ color: "#E8EAEC" }}>Factory statement — live mirror</h1>
        <span className="font-mono text-[8px] px-2 py-1 rounded border" style={{ color: "#8B949C", borderColor: "#262C31" }}>XLSX EXPORT</span>
      </div>
      <div className="mt-3 rounded-lg border overflow-x-auto" style={{ background: "#14181B", borderColor: "#262C31" }}>
        <table className="w-full font-mono text-[10px]" style={{ color: "#E8EAEC" }}>
          <thead>
            <tr style={{ background: "#0C0F11" }}>
              {["#","FACTORY","COMPANY","QTY","RATE/CONE","FEES","TOTAL","KIND","FLAG"].map(h => (
                <th key={h} className="px-2 py-2 text-left border-b border-r" style={{ borderColor: "#262C31", color: "#8B949C", fontSize: 8 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(lines ?? []).map((l, i) => (
              <tr key={l.id}>
                <td className="px-2 py-1.5 border-b border-r" style={{ borderColor: "#262C31", color: "#5C666D" }}>{i + 1}</td>
                <td className="px-2 py-1.5 border-b border-r" style={{ borderColor: "#262C31" }}>{(l.factories as unknown as {name:string})?.name}</td>
                <td className="px-2 py-1.5 border-b border-r" style={{ borderColor: "#262C31" }}>{l.company_label}</td>
                <td className="px-2 py-1.5 border-b border-r text-right" style={{ borderColor: "#262C31" }}>{Number(l.quantity).toLocaleString()}</td>
                <td className="px-2 py-1.5 border-b border-r text-right" style={{ borderColor: "#262C31" }}>{formatPerCone(BigInt(l.rate_per_cone_microcents))}</td>
                <td className="px-2 py-1.5 border-b border-r text-right" style={{ borderColor: "#262C31" }}>{formatUSD(BigInt(l.fees_cents))}</td>
                <td className="px-2 py-1.5 border-b border-r text-right font-bold" style={{ borderColor: "#262C31" }}>{formatUSD(BigInt(l.total_cents))}</td>
                <td className="px-2 py-1.5 border-b border-r" style={{ borderColor: "#262C31", color: "#8B949C" }}>{l.kind.toUpperCase()}</td>
                <td className="px-2 py-1.5 border-b" style={{ borderColor: "#262C31", color: "#F5B84B" }}>{l.discrepancy_flag ? `⚠ ${l.discrepancy_flag}` : ""}</td>
              </tr>
            ))}
            <tr style={{ background: "#0C0F11" }}>
              <td colSpan={6} className="px-2 py-2 border-r text-right font-bold" style={{ borderColor: "#262C31", color: "#8B949C" }}>SUM</td>
              <td className="px-2 py-2 text-right font-bold" style={{ color: "#2DD4BF" }}>{formatUSD(total)}</td>
              <td colSpan={2}></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="font-mono text-[8px] mt-2 px-1" style={{ color: "#5C666D" }}>
        LINES APPEAR AS THE FACTORY ADDS THEM · RATE MISMATCHES VS AGREED BID FLAG AUTOMATICALLY + RAISE A TASK · SERVICES LINES FEED TRUE COGS
      </p>
    </div>
  );
}
