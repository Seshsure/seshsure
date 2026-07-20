import { supabaseServer } from "@/lib/supabase-server";
import { BidForm } from "@/components/BidForm";

export const dynamic = "force-dynamic";

export default async function FactoryBoard() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: prof } = await sb.from("profiles").select("factory_id").eq("id", user!.id).single();
  const { data: factory } = await sb.from("factories").select("board_eligible").eq("id", prof!.factory_id!).single();
  const { data: posts } = await sb.from("run_board_posts")
    .select("id, specs, bid_deadline, run_board_bids(id, price_per_cone_microcents, declined)")
    .eq("status", "open").order("created_at", { ascending: false });

  if (!factory?.board_eligible) return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-center">
      <p className="text-[13px] font-bold" style={{ color: "#181818" }}>Board opens after your qualification run</p>
      <p className="text-[10px] mt-1" style={{ color: "#514C41" }}>Complete your first scored run and this page fills with open work.</p>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-5">
      <h1 className="font-bold text-[16px] mb-1" style={{ color: "#181818" }}>Open runs — bid to produce</h1>
      <p className="text-[10px] font-mono mb-3" style={{ color: "#514C41" }}>YOUR BID IS SEALED · AWARD NOTIFICATIONS COME FROM SESHSURE</p>
      <div className="rounded-xl border overflow-hidden" style={{ background: "#fff", borderColor: "#E7DFCE" }}>
        {(posts ?? []).map(p => {
          const specs = p.specs as Record<string, string | number>;
          const myBid = (p.run_board_bids as { id: string; price_per_cone_microcents: string | null; declined: boolean }[] | null)?.[0];
          return (
            <div key={p.id} className="px-4 py-3 border-b" style={{ borderColor: "#E7DFCE" }}>
              <p className="text-[12px] font-bold" style={{ color: "#181818" }}>
                {Number(specs.quantity ?? 0).toLocaleString()} × {specs.sku}
              </p>
              <p className="font-mono text-[8px] mt-0.5" style={{ color: "#514C41" }}>
                WINDOW: {specs.target_window}{p.bid_deadline ? ` · BIDS CLOSE ${new Date(p.bid_deadline).toLocaleDateString()}` : ""}
              </p>
              {myBid && !myBid.declined
                ? <p className="font-mono text-[10px] mt-2 font-bold" style={{ color: "#0D9488" }}>
                    ✓ YOUR BID: {(Number(myBid.price_per_cone_microcents) / 10000).toFixed(2)}¢/CONE — SEALED</p>
                : myBid?.declined
                ? <p className="font-mono text-[10px] mt-2" style={{ color: "#514C41" }}>DECLINED</p>
                : <BidForm postId={p.id} />}
            </div>
          );
        })}
        {!posts?.length && <p className="px-4 py-6 text-[11px]" style={{ color: "#514C41" }}>No open posts right now.</p>}
      </div>
    </div>
  );
}
