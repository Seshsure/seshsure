// ————— REGISTRY GENERATOR — one row per peel, golden placed by no one —————
// Runs at order approval. Algorithm:
//   1. Build the word bag: custom words ∪ standard pool (if enabled),
//      weighted glue-heavy for commons so packs read like language.
//   2. Assign tiers: exactly one golden (producer's word), then legendary/
//      epic/rare/uncommon from picks (cycled) or SeshSure-assigned from
//      flavor→noun preference, commons fill the rest.
//   3. Per-pack seeding (3-cone retail): every full pack gets ≥1 glue +
//      ≥1 verb — the SOP's guarantee that packs feel playable. 1-cone
//      retail is one word per pack; seeding doesn't apply.
//   4. Golden position: crypto-random swap AFTER layout. Stored only in
//      the row. No log line, no return value, no UI ever shows it.
//   5. Codes: XXXX-XXXX Crockford base32 (no I/L/O/U), crypto-random,
//      collision-retried. Checksum = sha256 over ordered seq|code|word.
// Batched inserts (2k rows/batch): a 100k-cone order ≈ 50 batches.
import type { SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32
const PEELS_PER_ROLL = 800;                            // one master case per roll

function mintCode(): string {
  const bytes = crypto.randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[bytes[i] % 32];
  return s.slice(0, 4) + "-" + s.slice(4);
}

type Tiers = {
  common: { count: number }; uncommon: { count: number };
  rare: { count: number; picks?: string[] }; epic: { count: number; picks?: string[] };
  legendary: { count: number; picks?: string[] }; golden: { word: string };
};
type Word = { word: string; category: string };

export async function generateRegistry(svc: SupabaseClient, orderId: string): Promise<{ rows: number; checksum: string }> {
  const { data: order } = await svc.from("arcade_orders")
    .select("id, qty_packs, retail_format, use_standard_mix, custom_words, tiers, registry_generated_at")
    .eq("id", orderId).single();
  if (!order) throw new Error("order not found");
  if (order.registry_generated_at) throw new Error("registry already generated");

  const tiers = order.tiers as Tiers;
  const custom = (order.custom_words as Word[]) ?? [];
  const total = order.qty_packs * 800;
  const fmt = parseInt(order.retail_format);

  // Word bag with categories.
  const words: Word[] = [...custom];
  if (order.use_standard_mix) {
    const { data: pool } = await svc.from("arcade_word_pool").select("word, category").eq("active", true);
    for (const p of pool ?? []) if (!words.some(w => w.word === p.word)) words.push(p);
  }
  const byCat = (c: string) => words.filter(w => w.category === c);
  const glue = byCat("glue"), verbs = byCat("verb");
  const assignPref = [...byCat("flavor"), ...byCat("noun"), ...verbs];        // SeshSure-assign preference
  const commonBag = [...glue, ...glue, ...glue, ...verbs, ...verbs, ...byCat("noun"), ...byCat("flavor")]; // glue-heavy weighting
  const pick = (arr: Word[]) => arr[crypto.randomInt(arr.length)];
  const catOf = (w: string) => words.find(x => x.word === w)?.category ?? "noun";

  // Tier word assignments in a flat array of {word, category, tier}.
  const peels: { word: string; category: string; tier: string }[] = [];
  const fromPicks = (tier: string, count: number, picks: string[] | undefined) => {
    for (let i = 0; i < count; i++) {
      const w = picks?.length ? picks[i % picks.length] : pick(assignPref.length ? assignPref : words).word;
      peels.push({ word: w, category: catOf(w), tier });
    }
  };
  fromPicks("legendary", tiers.legendary.count, tiers.legendary.picks);
  fromPicks("epic", tiers.epic.count, tiers.epic.picks);
  fromPicks("rare", tiers.rare.count, tiers.rare.picks);
  fromPicks("uncommon", tiers.uncommon.count, undefined);
  for (let i = 0; i < tiers.common.count; i++) {
    const w = pick(commonBag.length ? commonBag : words);
    peels.push({ word: w.word, category: w.category, tier: "common" });
  }
  peels.push({ word: tiers.golden.word, category: catOf(tiers.golden.word), tier: "golden" });
  if (peels.length !== total) throw new Error(`generator math: ${peels.length} != ${total}`);

  // Layout. For 3-cone retail, packs are CONSTRUCTED rather than shuffled-
  // then-repaired: each full pack gets a glue common + a verb common + a
  // third slot, and all non-common tier peels (golden included) are dealt
  // into randomly chosen third slots, then each pack is shuffled internally.
  // Golden ends up in a random pack at a random position — no human input,
  // no log. 1-cone retail is a straight crypto shuffle.
  let laid: { word: string; category: string; tier: string }[] = [];
  const specials = peels.filter(p => p.tier !== "common");
  let commonsLeft = peels.filter(p => p.tier === "common").length;
  const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  shuffle(specials);

  if (fmt === 3) {
    const fullPacks = Math.floor(total / 3);
    // Which packs receive a special in their third slot (may exceed one per
    // pack only when specials outnumber packs).
    const specialSlots: number[] = shuffle([...Array(fullPacks).keys()]).slice(0, Math.min(specials.length, fullPacks));
    const specialByPack = new Map<number, { word: string; category: string; tier: string }[]>();
    specials.forEach((sp, i) => {
      const pk = i < specialSlots.length ? specialSlots[i] : crypto.randomInt(fullPacks);
      const arr = specialByPack.get(pk) ?? []; arr.push(sp); specialByPack.set(pk, arr);
    });
    const mintCommon = (pref: Word[]) => {
      commonsLeft--;
      const w = pick(pref.length ? pref : (commonBag.length ? commonBag : words));
      return { word: w.word, category: w.category, tier: "common" };
    };
    const overflowSpecials: typeof specials = [];
    for (let pk = 0; pk < fullPacks; pk++) {
      const packSpecials = specialByPack.get(pk) ?? [];
      const pack: { word: string; category: string; tier: string }[] = packSpecials.slice(0, 3);
      overflowSpecials.push(...packSpecials.slice(3));
      if (pack.length < 3 && commonsLeft > 0 && !pack.some(p => p.category === "glue") && glue.length) pack.push(mintCommon(glue));
      if (pack.length < 3 && commonsLeft > 0 && !pack.some(p => p.category === "verb") && verbs.length) pack.push(mintCommon(verbs));
      while (pack.length < 3 && (commonsLeft > 0 || overflowSpecials.length > 0))
        pack.push(commonsLeft > 0 ? mintCommon([]) : overflowSpecials.shift()!);
      laid.push(...shuffle(pack));
    }
    // Remainder peels (total % 3): commons while they last, then overflow.
    while (laid.length < total)
      laid.push(commonsLeft > 0 ? mintCommon([]) : overflowSpecials.shift()!);
    if (commonsLeft !== 0 || overflowSpecials.length !== 0)
      throw new Error(`layout reconcile: commonsLeft=${commonsLeft} overflow=${overflowSpecials.length}`);
    if (laid.length !== total) throw new Error(`layout math: ${laid.length} != ${total}`);
  } else {
    laid = shuffle([...peels]);
  }
  const finalPeels = laid;
  // Mint codes (collision-safe within the run; DB unique index is the net).
  const seen = new Set<string>();
  const rows = finalPeels.map((p, i) => {
    let code = mintCode();
    while (seen.has(code)) code = mintCode();
    seen.add(code);
    return {
      order_id: orderId, seq: i + 1,
      roll_no: Math.floor(i / PEELS_PER_ROLL) + 1,
      pack_no: Math.floor(i / fmt) + 1,
      pos_in_pack: (i % fmt) + 1,
      code, word: p.word, category: p.category,
      tier: p.tier, is_golden: p.tier === "golden",
    };
  });

  const checksum = crypto.createHash("sha256")
    .update(rows.map(r => `${r.seq}|${r.code}|${r.word}`).join("\n")).digest("hex");

  for (let i = 0; i < rows.length; i += 2000) {
    const { error } = await svc.from("arcade_registry").insert(rows.slice(i, i + 2000));
    if (error) throw new Error(`registry insert failed at batch ${i / 2000}: ${error.message}`);
  }
  await svc.from("arcade_orders").update({
    registry_checksum: checksum, registry_generated_at: new Date().toISOString(), registry_rows: rows.length,
  }).eq("id", orderId);

  return { rows: rows.length, checksum };
}
