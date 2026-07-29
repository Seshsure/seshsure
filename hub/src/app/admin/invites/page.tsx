// ————— OWNER INVITES — anyone, any role, org inline —————
import { supabaseServer } from "@/lib/supabase-server";
import { AdminInvite } from "@/components/AdminInvite";

export const dynamic = "force-dynamic";

export default async function Invites() {
  const sb = supabaseServer();
  const [{ data: clients }, { data: factories }, { data: forwarders }, { data: converters }, { data: recent }] = await Promise.all([
    sb.from("clients").select("id, legal_name, dba").order("legal_name").limit(100),
    sb.from("factories").select("id, name").order("name").limit(50),
    sb.from("forwarders").select("id, name").order("name").limit(50),
    sb.from("converters").select("id, name").order("name").limit(50),
    sb.from("activity_log").select("created_at, after").eq("action", "invite.sent")
      .order("created_at", { ascending: false }).limit(10),
  ]);
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="display text-[22px]" style={{ color: "#181818" }}>INVITES</h1>
      <p className="font-mono text-[10px] mt-1 mb-4" style={{ color: "#5C574A" }}>
        EMAIL + ROLE IS ALL YOU ENTER · THEY SET THEIR OWN PASSWORD &amp; FILL THEIR OWN PROFILE
      </p>
      <AdminInvite
        clients={(clients ?? []).map(c => [c.id, c.dba ?? c.legal_name] as [string, string])}
        factories={(factories ?? []).map(f => [f.id, f.name] as [string, string])}
        forwarders={(forwarders ?? []).map(f => [f.id, f.name] as [string, string])}
        converters={(converters ?? []).map(f => [f.id, f.name] as [string, string])} />
      {!!recent?.length && (
        <div className="mt-6">
          <p className="font-mono text-[10px] font-bold" style={{ color: "#3E3A30" }}>RECENT INVITES</p>
          {recent.map((r, i) => {
            const a = r.after as { email?: string; role?: string; new_org?: string | null } | null;
            return (
              <p key={i} className="font-mono text-[10px] mt-1" style={{ color: "#5C574A" }}>
                {String(r.created_at).slice(0, 10)} · {a?.email} · {a?.role}{a?.new_org ? ` · new org: ${a.new_org}` : ""}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}
