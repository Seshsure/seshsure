// ————— ORDER APPROVAL: margin floor + credit ceiling + deposit dial + routing —————
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";
import { nextNumber, orderTotals, splitDeposit } from "@/lib/invoice";
import { conesToCents } from "@/lib/money";

const Body = z.object({
  orderId: z.string().uuid(),
  depositPct: z.number().int().min(0).max(100).optional(),
  earlyStart: z.boolean().optional(),
  factoryId: z.string().uuid().optional(),
  postToBoard: z.boolean().optional(),
});

const FLAGSHIP_PROFIT_FLOOR_MICRO = 150_000n; // 15¢ PROFIT per cone

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (prof?.role !== "owner") return NextResponse.json({ error: "owner only" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const { data: order } = await sb.from("orders")
    .select("id, client_id, status, deposit_pct, is_sample, order_items(product_id, quantity, price_per_cone_microcents, products(sku, is_flagship, description))")
    .eq("id", parsed.data.orderId).single();
  if (!order) return NextResponse.json({ error: "order not found" }, { status: 404 });
  if (order.status !== "submitted") return NextResponse.json({ error: `order is ${order.status}` }, { status: 400 });

  type Item = { product_id: string; quantity: number; price_per_cone_microcents: number;
    products: { sku: string; is_flagship: boolean; description: string } };
  const items = (order.order_items ?? []) as unknown as Item[];

  // ——— FLAGSHIP 15¢ PROFIT FLOOR (price − landed cost ≥ 15¢) ———
  for (const it of items) {
    if (!it.products?.is_flagship) continue;
    const price = BigInt(it.price_per_cone_microcents);
    const { data: rate } = await sb.from("factory_rate_card")
      .select("cost_per_cone_microcents, freight_per_cone_microcents, duty_per_cone_microcents")
      .eq("product_id", it.product_id).order("effective_at", { ascending: false }).limit(1).maybeSingle();
    if (!rate) return NextResponse.json({
      error: `MARGIN CHECK BLOCKED: no landed cost on file for ${it.products.sku}. Add the factory rate card first — the floor can't be verified without it.`,
    }, { status: 422 });
    const landed = BigInt(rate.cost_per_cone_microcents)
      + BigInt(rate.freight_per_cone_microcents ?? 0)
      + BigInt(rate.duty_per_cone_microcents ?? 0);
    const profit = price - landed;
    if (profit < FLAGSHIP_PROFIT_FLOOR_MICRO) {
      return NextResponse.json({
        error: `BLOCKED: ${it.products.sku} profit ${(Number(profit) / 10000).toFixed(2)}¢/cone < 15¢ floor (price ${(Number(price) / 10000).toFixed(2)}¢ − landed ${(Number(landed) / 10000).toFixed(2)}¢). Override requires a price change or a new cost basis.`,
      }, { status: 422 });
    }
  }

  // ——— CREDIT CEILING: live exposure + this order ———
  const { data: client } = await sb.from("clients")
    .select("credit_ceiling_cents, deposit_pct, legal_name, dba").eq("id", order.client_id).single();
  const lines = items.map(it => ({
    productId: it.product_id, quantity: BigInt(it.quantity),
    priceMicro: BigInt(it.price_per_cone_microcents), description: it.products?.description ?? "",
  }));
  const totals = orderTotals(lines, 0n, 0n, false);

  if (client?.credit_ceiling_cents) {
    const { data: openInv } = await sb.from("invoices")
      .select("total_cents, paid_cents").eq("client_id", order.client_id)
      .in("status", ["sent", "viewed", "partially_paid", "overdue"]);
    const exposure = (openInv ?? []).reduce((s, i) => s + BigInt(i.total_cents) - BigInt(i.paid_cents), 0n);
    if (exposure + totals.total > BigInt(client.credit_ceiling_cents)) {
      return NextResponse.json({
        error: `BLOCKED: exposure ${(exposure + totals.total).toString()}¢ would exceed ceiling ${client.credit_ceiling_cents}¢. Raise the ceiling, require a deposit, or collect first.`,
      }, { status: 422 });
    }
  }

  // ——— ROUTING ———
  if (parsed.data.postToBoard) {
    const flagged = items.some(it => it.products.is_flagship);
    if (flagged) return NextResponse.json({ error: "flagship orders never post to the board" }, { status: 422 });
    await sb.from("run_board_posts").insert({
      order_id: order.id, posted_by: user.id,
      specs: { sku: items[0]?.products?.description ?? "run",
        quantity: items.reduce((s, i) => s + Number(i.quantity), 0),
        target_window: "per order", art: null },
    });
  } else if (parsed.data.factoryId) {
    const flagged = items.some(it => it.products.is_flagship);
    if (flagged) {
      const { data: fac } = await sb.from("factories").select("flagship_approved").eq("id", parsed.data.factoryId).single();
      if (!fac?.flagship_approved) return NextResponse.json({ error: "that factory is not flagship-approved" }, { status: 422 });

    // ————— SAMPLE IP GATE — flagship samples ship only against a signed
    // Sample Evaluation & IP Protection Agreement. The patent doesn't leave
    // the building on a handshake.
    if (order.is_sample) {
      const { data: sig } = await sb.from("signatures")
        .select("id, agreement_versions!inner(doc_key)")
        .eq("client_id", order.client_id)
        .eq("agreement_versions.doc_key", "sample_eval")
        .limit(1);
      if (!sig?.length)
        return NextResponse.json({ error: "flagship sample blocked — no signed Sample Evaluation & IP Protection Agreement on file for this client. Mint a signing link from their page first." }, { status: 422 });
    }
    }
    await sb.from("orders").update({ routed_factory_id: parsed.data.factoryId }).eq("id", order.id);

    // Direct routing materializes the run immediately — the factory sees the
    // work the moment the order is approved (board path creates runs on award).
    const runNumber = `R-D-${1000 + Math.floor(Date.now() / 1000) % 90000}`;
    const { data: newRun, error: runErr } = await sb.from("production_runs").insert({
      run_number: runNumber, factory_id: parsed.data.factoryId, status: "placed",
    }).select("id").single();
    if (runErr || !newRun)
      return NextResponse.json({ error: `approved but run creation failed: ${runErr?.message}` }, { status: 500 });
    await sb.from("run_orders").insert({ run_id: newRun.id, order_id: order.id });
  }

  // ——— DEPOSIT DIAL ———
  const depositPct = parsed.data.depositPct ?? order.deposit_pct ?? client?.deposit_pct ?? 50;
  const { deposit } = splitDeposit(totals.total, depositPct);
  const orderNumber = await nextNumber(sb, "order");
  const expires = new Date(); expires.setDate(expires.getDate() + 14);

  await sb.from("orders").update({
    status: "approved", order_number: orderNumber, deposit_pct: depositPct,
    approved_by: user.id, approved_at: new Date().toISOString(),
    early_start_override: parsed.data.earlyStart ?? false,
    expires_at: deposit > 0n ? expires.toISOString() : null,
  }).eq("id", order.id);

  let invoiceNumber: string | null = null;
  if (deposit > 0n && !parsed.data.earlyStart) {
    invoiceNumber = await nextNumber(sb, "invoice");
    const { data: inv } = await sb.from("invoices").insert({
      invoice_number: invoiceNumber, client_id: order.client_id, order_id: order.id,
      kind: "deposit", status: "sent", sent_at: new Date().toISOString(),
      due_date: new Date().toISOString().slice(0, 10),
      subtotal_cents: deposit.toString(), total_cents: deposit.toString(), paid_cents: "0",
    }).select("id").single();
    for (const l of lines) {
      await sb.from("invoice_line_items").insert({
        invoice_id: inv!.id,
        description: `${depositPct}% deposit — ${l.description} × ${l.quantity.toLocaleString()}`,
        amount_cents: conesToCents(l.quantity, l.priceMicro).toString(),
      });
    }
    await sb.from("notification_log").insert({
      recipient: "client-ap", template_key: "invoice.sent",
      subject: `Deposit invoice ${invoiceNumber}`, related_id: inv!.id,
    });
  }

  const startsNow = deposit === 0n || parsed.data.earlyStart;
  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: prof.full_name,
    action: "order.approved", entity_table: "orders", entity_id: order.id, client_id: order.client_id,
    after: { order_number: orderNumber, deposit_pct: depositPct, total_cents: totals.total.toString(), starts_now: startsNow },
  });

  return NextResponse.json({ ok: true, orderNumber, invoiceNumber, totalCents: totals.total.toString(), startsNow, postedToBoard: !!parsed.data.postToBoard });
}
