// ————— PRODUCER ARCADE (HUB) — orders live here; play lives on seshsure.com —————
// Server-verifies approved access before rendering anything. The standard
// pool ships to the form so live validation matches the API exactly.
import { supabaseServer } from "@/lib/supabase-server";
import { ArcadeOrderForm } from "@/components/ArcadeOrderForm";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProducerArcade() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: prof } = await sb.from("profiles").select("client_id").eq("id", user!.id).single();
  const { data: access } = await sb.from("arcade_access").select("status, arcade_slug").eq("client_id", prof!.client_id!).maybeSingle();
  if (access?.status !== "approved") redirect("/portal");

  const [{ data: orders }, { data: pool }] = await Promise.all([
    sb.from("arcade_orders").select("id, order_number, status, qty_packs, retail_format, submitted_at, revision_note, hunt_sentence")
      .order("created_at", { ascending: false }).limit(20),
    sb.from("arcade_word_pool").select("word").eq("active", true),
  ]);

  const tone = (s: string) => s === "approved" ? "#0D9488" : s === "submitted" ? "#6C4AB0" : s === "revision_requested" ? "#B45309" : "#5C574A";

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="display text-[22px]" style={{ color: "#181818" }}>🕹️ ARCADE</h1>
      <p className="font-mono text-[10px] mt-1" style={{ color: "#5C574A" }}>
        YOUR ARCADE: seshsure.com/arcade/{access.arcade_slug} · ORDERS &amp; HUNTS OPERATE HERE
      </p>

      {(orders ?? []).length > 0 && (
        <div className="mt-4">
          <p className="font-mono text-[10px] font-bold" style={{ color: "#3E3A30" }}>YOUR ORDERS</p>
          {(orders ?? []).map(o => (
            <div key={o.id} className="rounded-lg border-2 p-3 mt-2 bg-white" style={{ borderColor: "#E7DFCE" }}>
              <div className="flex items-center justify-between">
                <p className="font-mono text-[12px] font-bold" style={{ color: "#181818" }}>
                  {o.order_number} · {o.qty_packs}×800 · {o.retail_format}-cone retail
                </p>
                <span className="font-mono text-[9px] font-bold px-2 py-0.5 rounded"
                  style={{ background: tone(o.status) + "15", color: tone(o.status) }}>
                  {o.status.replace(/_/g, " ").toUpperCase()}
                </span>
              </div>
              {o.hunt_sentence && <p className="font-mono text-[10px] mt-1" style={{ color: "#5C574A" }}>HUNT: &ldquo;{o.hunt_sentence}&rdquo;</p>}
              {o.status === "revision_requested" && o.revision_note && (
                <p className="text-[12px] mt-1.5 p-2 rounded" style={{ background: "#B4530910", color: "#B45309" }}>
                  <b>Revisions requested:</b> {o.revision_note}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-5">
        <p className="font-mono text-[10px] font-bold mb-2" style={{ color: "#3E3A30" }}>NEW ORDER</p>
        <ArcadeOrderForm standardPool={(pool ?? []).map(p => p.word)} />
      </div>
    </div>
  );
}
