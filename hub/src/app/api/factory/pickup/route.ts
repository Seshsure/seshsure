// ————— FACTORY SETS PICKUP-READY DATE — own runs only (RLS-enforced) —————
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";

const Body = z.object({
  runId: z.string().uuid(),
  pickupReadyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cartons: z.number().int().positive(),
  grossKg: z.number().positive(),
  dimsNote: z.string().min(3).max(200),
  packingListPath: z.string().min(3).optional(),
});

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { runId, pickupReadyDate, cartons, grossKg, dimsNote, packingListPath } = parsed.data;
  if (pickupReadyDate < new Date().toISOString().slice(0, 10))
    return NextResponse.json({ error: "pickup date can't be in the past" }, { status: 400 });

  const { data, error } = await sb.from("production_runs")
    .update({ pickup_ready_date: pickupReadyDate, packing_cartons: cartons, packing_gross_kg: grossKg, packing_dims_note: dimsNote, ...(packingListPath ? { packing_list_path: packingListPath } : {}) }).eq("id", runId).select("id").single();
  if (error || !data) return NextResponse.json({ error: "not permitted" }, { status: 403 });

  // ————— CARGO READY → RFQ AUTO-OPENS ON THE FREIGHT DESK —————
  // The factory's declaration IS the quote request: real cartons, real kg,
  // real dims flow straight into cargo_summary so forwarders bid on facts,
  // not estimates. Idempotent — re-declaring pickup updates the open RFQ
  // instead of stacking duplicates. Runs service-role: factories can't
  // touch freight_rfqs directly (owner's commercial surface), but their
  // readiness declaration is what legitimately opens one.
  const { createClient } = await import("@supabase/supabase-js");
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: runCtx } = await svc.from("production_runs")
    .select("run_number, factory_id, factories(origin_port), run_orders(orders(freight_mode, order_items(quantity)))")
    .eq("id", runId).single();
  if (runCtx) {
    type RO = { orders: { freight_mode: string | null; order_items: { quantity: number }[] | null } | null };
    const ros = (runCtx.run_orders ?? []) as unknown as RO[];
    const units = ros.reduce((n, ro) => n + (ro.orders?.order_items ?? []).reduce((m, i) => m + (i.quantity ?? 0), 0), 0);
    const mode = ros.some(ro => ro.orders?.freight_mode === "air") ? "air" : "sea";
    const cargo = {
      cartons, weightKg: grossKg, dims: dimsNote,
      originPort: (runCtx.factories as unknown as { origin_port: string | null } | null)?.origin_port ?? "TBD",
      destination: "Denver, CO (DEN)", readyDate: pickupReadyDate,
      runNumber: runCtx.run_number,
    };
    const { data: existing } = await svc.from("freight_rfqs")
      .select("id").eq("run_id", runId).eq("status", "open").maybeSingle();
    if (existing) {
      await svc.from("freight_rfqs").update({ cargo_summary: cargo, mode }).eq("id", existing.id);
    } else {
      await svc.from("freight_rfqs").insert({
        run_id: runId, mode, cargo_summary: cargo, status: "open",
        units_count: units || null,
      });
    }
  }

  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: "factory", action: "run.pickup_ready_set",
    entity_table: "production_runs", entity_id: runId, after: { pickup_ready_date: pickupReadyDate, cartons, gross_kg: grossKg },
  });
  return NextResponse.json({ ok: true });
}
