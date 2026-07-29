// ————— APPLICATIONS REVIEW — the human gate that makes it "verified only" —————
// Each card shows verification signals (email domain vs website match,
// freemail flag, license offered) so the decision takes seconds. APPROVE
// creates the client and fires the standard invite in one motion.
import { supabaseServer } from "@/lib/supabase-server";
import { ApplicationCard } from "@/components/ApplicationCard";

export const dynamic = "force-dynamic";

export default async function Applications() {
  const sb = supabaseServer();
  const { data: apps } = await sb.from("access_applications")
    .select("*").order("created_at", { ascending: false }).limit(60);
  const pending = (apps ?? []).filter(a => a.status === "pending");
  const decided = (apps ?? []).filter(a => a.status !== "pending");

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="display text-[22px]" style={{ color: "#181818" }}>APPLICATIONS</h1>
      <p className="font-mono text-[10px] mt-1 mb-4" style={{ color: "#5C574A" }}>
        SHARE hub.seshsure.com/apply ANYWHERE · ADD ?ref=CODE FOR CAMPAIGN ATTRIBUTION · APPROVE = CLIENT + INVITE IN ONE TAP
      </p>
      {pending.length ? pending.map(a => <ApplicationCard key={a.id} app={a} />) :
        <p className="text-[13px] py-3" style={{ color: "#5C574A" }}>No pending applications.</p>}
      {decided.length > 0 && (
        <details className="mt-5">
          <summary className="font-mono text-[11px] font-bold cursor-pointer" style={{ color: "#3E3A30" }}>DECIDED ({decided.length})</summary>
          {decided.map(a => (
            <p key={a.id} className="font-mono text-[10px] mt-1.5" style={{ color: "#5C574A" }}>
              {a.status === "approved" ? "✓" : "✕"} {a.company} · {a.email} · {String(a.created_at).slice(0, 10)}{a.ref_code ? ` · ref:${a.ref_code}` : ""}
            </p>
          ))}
        </details>
      )}
    </div>
  );
}
