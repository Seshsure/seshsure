// Post an order to the Run Board (owner) — flagship triple-gated
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({
  orderId: z.string().uuid(),
  bidDeadline: z.string().optional(),
  targetWindow: z.string().max(60).optional(),
});

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (prof?.role !== "owner") return NextResponse.json({ error: "owner only" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const { data: order } = await sb.from("orders")
    .select("id, order_number, order_items(quantity, products(description, is_flagship))")
    .eq("id", parsed.data.orderId).single();
  if (!order) return NextResponse.json({ error: "order not found" }, { status: 404 });

  type Item = { quantity: number; products: { description: string; is_flagship: boolean } };
  const items = (order.order_items ?? []) as unknown as Item[];
  if (items.some(i => i.products?.is_flagship))
    return NextResponse.json({ error: "flagship orders NEVER post to the board — assign to a flagship-approved factory instead" }, { status: 422 });

  const { data: post, error } = await sb.from("run_board_posts").insert({
    order_id: order.id, posted_by: user.id,
    bid_deadline: parsed.data.bidDeadline ?? null,
    specs: {
      sku: items[0]?.products?.description ?? "run",
      quantity: items.reduce((s, i) => s + Number(i.quantity), 0),
      target_window: parsed.data.targetWindow ?? "flexible",
    },
  }).select("id").single();
  if (error || !post) return NextResponse.json({ error: error?.message }, { status: 500 });

  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: prof.full_name,
    action: "board.posted", entity_table: "run_board_posts", entity_id: post.id,
    after: { order: order.order_number },
  });
  return NextResponse.json({ ok: true, postId: post.id });
}
