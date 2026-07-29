// ————— ARCADE ORDERS — submit (producer) / decide (owner) —————
// Validation IS the review gate's first half, run at submit so producers
// fix problems before a human ever looks: print-fit (≤12 chars, A–Z only),
// tier math (counts sum to total peels, golden exactly one), picks exist
// in the available word set, sentence words exist in the printed mix.
// Owner review is one consolidated decision per SOP: approve, or a single
// revision note listing everything at once.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { sendTemplate } from "@/lib/email";

const WordRe = /^[A-Z]{1,12}$/;
const Tiers = z.object({
  common: z.object({ count: z.number().int().min(0) }),
  uncommon: z.object({ count: z.number().int().min(0) }),
  rare: z.object({ count: z.number().int().min(0), picks: z.array(z.string()).default([]) }),
  epic: z.object({ count: z.number().int().min(0), picks: z.array(z.string()).default([]) }),
  legendary: z.object({ count: z.number().int().min(0), picks: z.array(z.string()).default([]) }),
  golden: z.object({ word: z.string() }),
});

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("submit"),
    orderId: z.string().uuid().optional(),          // resubmit after revision
    artworkPath: z.string().max(300).optional(),
    useStandardMix: z.boolean(),
    customWords: z.array(z.object({ word: z.string(), category: z.enum(["glue", "verb", "noun", "flavor"]) })).max(200),
    tiers: Tiers,
    huntSentence: z.string().max(200).optional(),
    qtyPacks: z.number().int().min(1).max(500),
    retailFormat: z.enum(["1", "3"]),
    shipTo: z.string().min(6).max(300),
    neededBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    saleStates: z.array(z.string().length(2)).min(1).max(60),
    notes: z.string().max(500).optional(),
  }),
  z.object({
    action: z.enum(["approve", "revise"]),
    orderId: z.string().uuid(),
    revisionNote: z.string().max(1000).optional(),  // required for revise
  }),
]);

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: me } = await sb.from("profiles").select("role, client_id, full_name").eq("id", user.id).single();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "bad request" }, { status: 400 });
  const b = parsed.data;
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // ————— PRODUCER SUBMITS —————
  if (b.action === "submit") {
    if (me?.role !== "client_admin" || !me.client_id)
      return NextResponse.json({ error: "client admins only" }, { status: 403 });
    const { data: access } = await svc.from("arcade_access").select("status").eq("client_id", me.client_id).maybeSingle();
    if (access?.status !== "approved")
      return NextResponse.json({ error: "arcade access not approved" }, { status: 403 });

    // Print-fit: every custom word ≤12 chars, A–Z only, deduped.
    const custom = b.customWords.map(w => ({ word: w.word.toUpperCase().trim(), category: w.category }));
    for (const w of custom) if (!WordRe.test(w.word))
      return NextResponse.json({ error: `word fails print-fit: "${w.word}" (A–Z only, max 12 chars)` }, { status: 400 });
    if (new Set(custom.map(w => w.word)).size !== custom.length)
      return NextResponse.json({ error: "duplicate words in custom list" }, { status: 400 });

    // Available word set = custom ∪ (standard pool if mix enabled).
    const available = new Set(custom.map(w => w.word));
    if (b.useStandardMix) {
      const { data: pool } = await svc.from("arcade_word_pool").select("word").eq("active", true);
      for (const p of pool ?? []) available.add(p.word);
    }
    if (available.size === 0) return NextResponse.json({ error: "no words: add custom words or enable the standard mix" }, { status: 400 });

    // Tier math: counts sum to total peels exactly; golden is exactly one.
    const total = b.qtyPacks * 800;
    const t = b.tiers;
    const sum = t.common.count + t.uncommon.count + t.rare.count + t.epic.count + t.legendary.count + 1;
    if (sum !== total) return NextResponse.json(
      { error: `tier counts (incl. 1 golden) sum to ${sum}, but ${b.qtyPacks} packs = ${total} peels` }, { status: 400 });

    // Picks + golden + sentence words must exist in the available set.
    const goldenWord = t.golden.word.toUpperCase().trim();
    if (!WordRe.test(goldenWord)) return NextResponse.json({ error: "golden word fails print-fit" }, { status: 400 });
    if (!available.has(goldenWord)) return NextResponse.json({ error: `golden word "${goldenWord}" is not in your word set` }, { status: 400 });
    for (const [tier, picks] of [["rare", t.rare.picks], ["epic", t.epic.picks], ["legendary", t.legendary.picks]] as const) {
      for (const p of picks) {
        const up = p.toUpperCase().trim();
        if (!available.has(up)) return NextResponse.json({ error: `${tier} pick "${up}" is not in your word set` }, { status: 400 });
      }
    }
    let sentence: string | null = null;
    if (b.huntSentence?.trim()) {
      sentence = b.huntSentence.toUpperCase().trim().replace(/\s+/g, " ");
      for (const w of sentence.split(" ")) {
        if (!available.has(w)) return NextResponse.json(
          { error: `sentence word "${w}" is not in your word set — every hunt word must be printable in this run` }, { status: 400 });
      }
    }

    const normalizedTiers = { ...t, golden: { word: goldenWord },
      rare: { ...t.rare, picks: t.rare.picks.map(p => p.toUpperCase().trim()) },
      epic: { ...t.epic, picks: t.epic.picks.map(p => p.toUpperCase().trim()) },
      legendary: { ...t.legendary, picks: t.legendary.picks.map(p => p.toUpperCase().trim()) } };
    const row = {
      client_id: me.client_id, status: "submitted" as const,
      artwork_path: b.artworkPath ?? null, use_standard_mix: b.useStandardMix,
      custom_words: custom, tiers: normalizedTiers, hunt_sentence: sentence,
      qty_packs: b.qtyPacks, retail_format: b.retailFormat, ship_to: b.shipTo,
      needed_by: b.neededBy ?? null, sale_states: b.saleStates.map(s => s.toUpperCase()),
      notes: b.notes ?? null, submitted_at: new Date().toISOString(),
      revision_note: null, created_by: user.id,
    };

    let orderId = b.orderId ?? null, orderNumber: string | null = null;
    if (orderId) {
      const { data: existing } = await svc.from("arcade_orders").select("status, client_id, order_number").eq("id", orderId).single();
      if (!existing || existing.client_id !== me.client_id || !["draft", "revision_requested"].includes(existing.status))
        return NextResponse.json({ error: "order not editable" }, { status: 403 });
      await svc.from("arcade_orders").update(row).eq("id", orderId);
      orderNumber = existing.order_number;
    } else {
      orderNumber = "ARC-" + Math.random().toString(36).slice(2, 6).toUpperCase();
      const { data: created, error } = await svc.from("arcade_orders").insert({ ...row, order_number: orderNumber }).select("id").single();
      if (error || !created) return NextResponse.json({ error: "create failed" }, { status: 500 });
      orderId = created.id;
    }

    await svc.from("activity_log").insert({
      actor_profile_id: user.id, actor_label: "client", action: "arcade.order.submitted",
      entity_table: "arcade_orders", entity_id: orderId,
      after: { order_number: orderNumber, packs: b.qtyPacks, total, sentence: !!sentence },
    });
    await sendTemplate({
      to: "rob@seshsure.com", templateKey: "arcade.order",
      vars: { number: orderNumber ?? "ARC-?", packs: String(b.qtyPacks), total: total.toLocaleString(), name: me.full_name ?? "producer" },
      systemOverride: true, bccOwner: false,
    }).catch(() => {});
    return NextResponse.json({ ok: true, orderId, orderNumber });
  }

  // ————— OWNER DECIDES (one consolidated decision) —————
  if (me?.role !== "owner") return NextResponse.json({ error: "owner only" }, { status: 403 });
  const { data: order } = await svc.from("arcade_orders").select("id, status, order_number").eq("id", b.orderId).single();
  if (!order || order.status !== "submitted") return NextResponse.json({ error: "not in review" }, { status: 400 });

  if (b.action === "revise" && !b.revisionNote?.trim())
    return NextResponse.json({ error: "one consolidated revision note is required" }, { status: 400 });

  await svc.from("arcade_orders").update({
    status: b.action === "approve" ? "approved" : "revision_requested",
    reviewed_by: user.id, reviewed_at: new Date().toISOString(),
    revision_note: b.action === "revise" ? b.revisionNote : null,
  }).eq("id", b.orderId);
  await svc.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: "owner",
    action: `arcade.order.${b.action === "approve" ? "approved" : "revision_requested"}`,
    entity_table: "arcade_orders", entity_id: b.orderId, after: { order_number: order.order_number },
  });
  return NextResponse.json({ ok: true });
}
