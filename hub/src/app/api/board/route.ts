// Factory bids on a board post (sealed — RLS shows them only their own bid)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({
  postId: z.string().uuid(),
  pricePerConeCents: z.string().optional(),   // "2.85"
  promiseDate: z.string().optional(),
  capacityNote: z.string().max(500).optional(),
  decline: z.boolean().default(false),
  declineReason: z.string().max(300).optional(),
});

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("factory_id, full_name").eq("id", user.id).single();
  if (!prof?.factory_id) return NextResponse.json({ error: "factory only" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;

  const { data: factory } = await sb.from("factories").select("board_eligible").eq("id", prof.factory_id).single();
  if (!factory?.board_eligible)
    return NextResponse.json({ error: "board access opens after your qualification run is complete" }, { status: 403 });

  const { data: post } = await sb.from("run_board_posts").select("id, status").eq("id", b.postId).single();
  if (!post || post.status !== "open") return NextResponse.json({ error: "post not open" }, { status: 400 });

  let priceMicro: bigint | null = null;
  if (!b.decline) {
    const cents = parseFloat(b.pricePerConeCents ?? "");
    if (!(cents > 0)) return NextResponse.json({ error: "price required (or decline)" }, { status: 400 });
    priceMicro = BigInt(Math.round(cents * 10000));
  }

  const { error } = await sb.from("run_board_bids").upsert({
    post_id: b.postId, factory_id: prof.factory_id,
    price_per_cone_microcents: priceMicro?.toString() ?? null,
    promise_date: b.promiseDate ?? null, capacity_note: b.capacityNote ?? null,
    declined: b.decline, decline_reason: b.declineReason ?? null,
  }, { onConflict: "post_id,factory_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, message: b.decline ? "Declined — thanks for the quick answer." : "Bid received. You'll hear if you're awarded." });
}
