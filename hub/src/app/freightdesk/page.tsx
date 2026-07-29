// ————— FORWARDER DESK — the awarded carrier's single pane —————
// Everything here is RLS-scoped: the query can only return shipments
// awarded to this forwarder. No pricing beyond their own award, no client
// identities, no factory internals — identifiers, dates, and status.
import { supabaseServer } from "@/lib/supabase-server";
import { ShipmentUpdate } from "@/components/ShipmentUpdate";

export const dynamic = "force-dynamic";

export default async function FreightDesk() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: prof } = await sb.from("profiles").select("forwarder_id, full_name").eq("id", user!.id).single();
  const { data: fwd } = prof?.forwarder_id
    ? await sb.from("forwarders").select("name, profile_completed_at").eq("id", prof.forwarder_id).single()
    : { data: null };
  const { data: shipments } = await sb.from("shipments")
    .select("id, status, mode, carrier, awb, container_no, bl_no, etd, eta, arrived_port_at, last_scan_at, delivered_at, production_runs(run_number)")
    .is("delivered_at", null).order("created_at", { ascending: false }).limit(30);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="display text-[22px]" style={{ color: "#181818" }}>ACTIVE SHIPMENTS</h1>
      <p className="font-mono text-[10px] mt-1" style={{ color: "#5C574A" }}>
        {fwd?.name?.toUpperCase() ?? "FORWARDER"} · UPDATE STATUS, ETA &amp; MILESTONES · DELIVERY IS CONFIRMED BY SESHSURE VIA POD
      </p>
      {fwd && !("profile_completed_at" in fwd && fwd.profile_completed_at) && (
        <a href="/freightdesk/profile" className="block mt-3 rounded-lg border-2 p-3" style={{ borderColor: "#FF8A3D", background: "#FF8A3D15" }}>
          <p className="font-mono text-[11px] font-bold" style={{ color: "#181818" }}>COMPLETE YOUR COMPANY PROFILE →</p>
          <p className="font-mono text-[9px] mt-0.5" style={{ color: "#5C574A" }}>IDENTITY, CREDENTIALS, LANES &amp; REMITTANCE — TAKES 5 MINUTES, REQUIRED BEFORE FIRST PAYMENT</p>
        </a>
      )}
      <div className="mt-4">
        {(shipments ?? []).map(s => (
          <div key={s.id} className="rounded-lg border-2 p-3 mb-3 bg-white" style={{ borderColor: "#E7DFCE" }}>
            <div className="flex items-center justify-between">
              <p className="font-mono text-[12px] font-bold" style={{ color: "#181818" }}>
                {(s.production_runs as unknown as { run_number: string } | null)?.run_number ?? "—"} · {String(s.mode).toUpperCase()}
              </p>
              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "#0D948815", color: "#0D9488" }}>
                {String(s.status).replace(/_/g, " ").toUpperCase()}
              </span>
            </div>
            <p className="font-mono text-[10px] mt-1" style={{ color: "#5C574A" }}>
              {s.awb ? `AWB ${s.awb}` : s.container_no ? `CNTR ${s.container_no}` : s.bl_no ? `B/L ${s.bl_no}` : "no identifier yet"}
              {s.carrier ? ` · ${s.carrier}` : ""}{s.eta ? ` · ETA ${s.eta}` : ""}
            </p>
            <ShipmentUpdate shipmentId={s.id} currentEta={s.eta} />
          </div>
        ))}
        {!shipments?.length && <p className="text-[13px] py-4" style={{ color: "#5C574A" }}>No active shipments assigned.</p>}
      </div>
    </div>
  );
}
