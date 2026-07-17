// Factory statement-of-account: line builder (factory adds lines, Rob mirrors live)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const AddLine = z.object({
  action: z.literal("add_line"),
  runId: z.string().uuid().optional(),
  companyLabel: z.string().min(1),
  quantity: z.number().int().positive(),
  shipLabel: z.string().optional(),
  ratePerConeCents: z.string(),
  feesCents: z.string().regex(/^\d+$/).default("0"),
  kind: z.enum(["goods","services","freight","other"]).default("goods"),
});
const RemoveLine = z.object({ action: z.literal("remove_line"), lineId: z.string().uuid() });
const Body = z.discriminatedUnion("action", [AddLine, RemoveLine]);

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("factory_id, full_name").eq("id", user.id).single();
  if (!prof?.factory_id) return NextResponse.json({ error: "factory only" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;

  if (b.action === "add_line") {
    const rate = parseFloat(b.ratePerConeCents);
    if (!(rate > 0)) return NextResponse.json({ error: "invalid rate" }, { status: 400 });
    const rateMicro = BigInt(Math.round(rate * 10000));
    const goods = (BigInt(b.quantity) * rateMicro) / 10000n;
    const rem = (BigInt(b.quantity) * rateMicro) % 10000n;
    const goodsCents = rem * 2n >= 10000n ? goods + 1n : goods;
    const totalCents = goodsCents + BigInt(b.feesCents);

    let flag: string | null = null;
    if (b.runId) {
      const { data: run } = await sb.from("production_runs").select("bid_price_microcents").eq("id", b.runId).single();
      const expected = run?.bid_price_microcents ? BigInt(run.bid_price_microcents) : null;
      if (expected && rateMicro !== expected) {
        const diff = ((rateMicro - expected) * BigInt(b.quantity)) / 10000n;
        flag = `rate ${rate.toFixed(4)}¢ vs agreed ${(Number(expected)/10000).toFixed(4)}¢ = ${diff >= 0n ? "+" : "−"}$${(Number(diff < 0n ? -diff : diff)/100).toFixed(2)}`;
      }
    }

    const { data: line, error } = await sb.from("factory_statement_lines").insert({
      factory_id: prof.factory_id, run_id: b.runId ?? null,
      company_label: b.companyLabel, quantity: b.quantity, ship_label: b.shipLabel ?? null,
      rate_per_cone_microcents: rateMicro.toString(), fees_cents: b.feesCents,
      total_cents: totalCents.toString(), kind: b.kind,
      discrepancy_flag: flag, added_by: user.id,
    }).select("id, total_cents, discrepancy_flag").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (flag) await sb.from("tasks").insert({
      title: `⚠ Factory statement discrepancy: ${b.companyLabel} — ${flag}`,
      kind: "statement_flag", related_id: line!.id, auto_generated: true,
      due_on: new Date().toISOString().slice(0, 10),
    });
    return NextResponse.json({ ok: true, lineId: line!.id, totalCents: line!.total_cents, flag });
  }

  const { error } = await sb.from("factory_statement_lines")
    .delete().eq("id", b.lineId).eq("factory_id", prof.factory_id).is("settled_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
