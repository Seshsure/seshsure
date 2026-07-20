import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function AdminBoard() {
  const sb = supabaseServer();
  const { data: posts } = await sb.from("run_board_posts")
    .select("id, specs, status, bid_deadline, created_at, run_board_bids(id, price_per_cone_microcents, promise_date, capacity_note, declined, factories(name))")
    .eq("status", "open").order("created_at", { ascending: false });
  const { data: scores } = await sb.from("factory_scorecards").select("*");
  const scoreByName = new Map((scores ?? []).map(s => [s.name, s]));

  return (
    <div className="max-w-5xl mx-auto px-4 pb-8">
      <div className="mt-4 rounded-lg border overflow-hidden" style={{ background: "#14181B", borderColor: "#262C31" }}>
        <div className="px-3 py-2 border-b" style={{ borderColor: "#262C31" }}>
          <span className="font-mono text-[10px] font-bold" style={{ color: "#8B949C" }}>RUN BOARD — SEALED BIDS · VALUE BESIDE PRICE</span>
        </div>
        {(posts ?? []).map(p => {
          const specs = p.specs as Record<string, string | number>;
          type Bid = { id: string; price_per_cone_microcents: string | null; promise_date: string | null; capacity_note: string | null; declined: boolean; factories: { name: string } };
          const bids = ((p.run_board_bids ?? []) as unknown as Bid[]).filter(b => !b.declined)
            .sort((a, b) => Number(a.price_per_cone_microcents ?? 0) - Number(b.price_per_cone_microcents ?? 0));
          return (
            <div key={p.id} className="px-3 py-3 border-b" style={{ borderColor: "#262C31" }}>
              <p className="text-[12px] font-bold" style={{ color: "#E8EAEC" }}>
                {String(specs.quantity ?? "?").toLocaleString()} × {specs.sku}
              </p>
              {bids.map(b => {
                const sc = scoreByName.get(b.factories?.name);
                const onTime = sc && sc.promised_runs >= 10 ? `${Math.round(100 * sc.on_time_runs / sc.promised_runs)}% ON-TIME (${sc.promised_runs})` : "COLLECTING DATA";
                return (
                  <div key={b.id} className="flex items-center mt-2 pl-2">
                    <div className="flex-1">
                      <p className="text-[11px] font-semibold" style={{ color: "#E8EAEC" }}>{b.factories?.name}</p>
                      <p className="font-mono text-[7px]" style={{ color: "#5C666D" }}>{onTime}{b.promise_date ? ` · SHIP ${b.promise_date}` : ""}</p>
                    </div>
                    <span className="font-mono text-[12px] font-bold" style={{ color: "#2DD4BF" }}>
                      {b.price_per_cone_microcents ? `${(Number(b.price_per_cone_microcents) / 10000).toFixed(2)}¢` : "—"}
                    </span>
                  </div>
                );
              })}
              {!bids.length && <p className="font-mono text-[8px] mt-1" style={{ color: "#5C666D" }}>AWAITING BIDS</p>}
            </div>
          );
        })}
        {!posts?.length && <p className="px-3 py-4 text-[11px]" style={{ color: "#5C666D" }}>Nothing posted.</p>}
      </div>
      <p className="font-mono text-[8px] mt-2 px-1" style={{ color: "#5C666D" }}>
        FACTORIES SEE ONLY THEIR OWN BID · CLIENT IDENTITY ANONYMIZED · FLAGSHIP NEVER POSTS
      </p>
    </div>
  );
}
