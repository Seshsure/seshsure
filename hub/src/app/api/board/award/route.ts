// Owner awards a board post → run created at the winning factory at BID PRICE
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({ postId: z.string().uuid(), bidId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (prof?.role !== "owner") return NextResponse.json({ error: "owner only" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const { data: bid } = await sb.from("run_board_bids")
    .select("id, post_id, factory_id, price_per_cone_microcents, promise_date, declined")
    .eq("id", parsed.data.bidId).single();
  if (!bid || bid.post_id !== parsed.data.postId || bid.declined)
    return NextResponse.json({ error: "bid not found" }, { status: 404 });

  const { data: post } = await sb.from("run_board_posts")
    .select("id, order_id, status").eq("id", parsed.data.postId).single();
  if (!post || post.status !== "open") return NextResponse.json({ error: "post not open" }, { status: 400 });

  await sb.from("run_board_posts").update({
    status: "awarded", awarded_factory_id: bid.factory_id, awarded_at: new Date().toISOString(),
  }).eq("id", post.id);

  const runNumber = `R-B-${1000 + Math.floor(Date.now() / 1000) % 90000}`;
  const { data: run } = await sb.from("production_runs").insert({
    run_number: runNumber, factory_id: bid.factory_id, status: "placed",
    promise_date: bid.promise_date, bid_price_microcents: bid.price_per_cone_microcents,
  }).select("id").single();
  if (run && post.order_id) {
    await sb.from("run_orders").insert({ run_id: run.id, order_id: post.order_id });
    await sb.from("orders").update({ status: "in_production", routed_factory_id: bid.factory_id }).eq("id", post.order_id);
  }
  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: prof.full_name,
    action: "board.awarded", entity_table: "run_board_posts", entity_id: post.id,
    after: { factory: bid.factory_id, run: runNumber, price_micro: bid.price_per_cone_microcents },
  });
  return NextResponse.json({ ok: true, runNumber });
}
