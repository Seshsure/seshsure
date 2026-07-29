// ————— ARCADE ADMIN — access decisions, compliance gate at approval —————
import { supabaseServer } from "@/lib/supabase-server";
import { ArcadeAccessCard } from "@/components/ArcadeAccessCard";

export const dynamic = "force-dynamic";

export default async function ArcadeAdmin() {
  const sb = supabaseServer();
  const { data: rows } = await sb.from("arcade_access")
    .select("client_id, status, applied_at, application_note, arcade_slug, rules_doc_path, clients(legal_name, dba)")
    .order("applied_at", { ascending: false }).limit(50);
  const pending = (rows ?? []).filter(r => r.status === "applied");
  const rest = (rows ?? []).filter(r => r.status !== "applied");

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="display text-[22px]" style={{ color: "#181818" }}>ARCADE</h1>
      <p className="font-mono text-[10px] mt-1 mb-4" style={{ color: "#5C574A" }}>
        APPROVAL REQUIRES THE COUNSEL-REVIEWED SWEEPSTAKES RULES DOC + A SLUG · SUSPEND STOPS NEW ORDERS/HUNTS, LIVE HUNTS FINISH
      </p>
      {pending.length ? pending.map(r => <ArcadeAccessCard key={r.client_id} row={r as never} />) :
        <p className="text-[13px] py-2" style={{ color: "#5C574A" }}>No pending applications.</p>}
      {rest.length > 0 && (
        <div className="mt-5">
          <p className="font-mono text-[10px] font-bold" style={{ color: "#3E3A30" }}>PROGRAM MEMBERS &amp; HISTORY</p>
          {rest.map(r => <ArcadeAccessCard key={r.client_id} row={r as never} />)}
        </div>
      )}
    </div>
  );
}
