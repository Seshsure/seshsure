// Team page: roster is RLS-scoped to the caller's own org; management
// authority is decided server-side — this page only shapes the UI.
import { supabaseServer } from "@/lib/supabase-server";
import { TeamManager } from "@/components/TeamManager";

export const dynamic = "force-dynamic";

export default async function Team() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: me } = await sb.from("profiles").select("role").eq("id", user!.id).single();
  const { data: members } = await sb.from("profiles")
    .select("id, full_name, email, role, is_active")
    .order("created_at", { ascending: true }).limit(50);
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="display text-[22px]" style={{ color: "#181818" }}>TEAM</h1>
      <p className="font-mono text-[10px] mt-1 mb-4" style={{ color: "#5C574A" }}>
        ONLY YOUR ORGANIZATION CAN SEE THIS LIST · INVITEES SET THEIR OWN CREDENTIALS
      </p>
      <TeamManager members={members ?? []} selfId={user!.id}
        canManage={me?.role === "client_admin"}
        roleOptions={[["client_admin","Admin"],["client_ap","Accounts Payable"]]} />
    </div>
  );
}
