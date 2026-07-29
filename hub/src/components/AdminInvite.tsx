"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const INK = "#181818", TEAL = "#0D9488", LINE = "#E7DFCE", RED = "#D62839";
const ROLES: [string, string, "client" | "factory" | "forwarder" | null][] = [
  ["client_admin", "Client Admin", "client"], ["client_ap", "Client AP", "client"],
  ["factory_admin", "Factory Admin", "factory"], ["factory_user", "Factory User", "factory"],
  ["forwarder_admin", "Forwarder", "forwarder"], ["staff", "Staff (internal)", null],
];

export function AdminInvite({ clients, factories, forwarders }: {
  clients: [string, string][]; factories: [string, string][]; forwarders: [string, string][];
}) {
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [role, setRole] = useState("client_admin");
  const [orgId, setOrgId] = useState(""); const [newOrgName, setNewOrgName] = useState("");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<[string, boolean] | null>(null);
  const router = useRouter();

  const orgType = ROLES.find(r => r[0] === role)?.[2] ?? null;
  const orgList = orgType === "client" ? clients : orgType === "factory" ? factories : orgType === "forwarder" ? forwarders : [];

  async function send() {
    setMsg(null); setBusy(true);
    const body: Record<string, unknown> = { email, fullName: name, role };
    if (orgType) {
      if (orgId === "__new__") body.newOrg = { type: orgType, name: newOrgName };
      else if (orgType === "client") body.clientId = orgId;
      else if (orgType === "factory") body.factoryId = orgId;
      else body.forwarderId = orgId;
    }
    const res = await fetch("/api/admin/invite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { setMsg([(await res.json()).error ?? "failed", false]); return; }
    setMsg([`Invite sent to ${email}`, true]); setName(""); setEmail(""); setOrgId(""); setNewOrgName("");
    router.refresh();
  }

  const inp = "rounded border-2 px-2 py-1.5 text-[13px] w-full";
  return (
    <div className="rounded-lg border-2 p-3" style={{ borderColor: LINE, background: "#fff" }}>
      <div className="flex flex-col gap-2">
        <input className={inp} style={{ borderColor: LINE }} placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
        <input className={inp} style={{ borderColor: LINE }} placeholder="work@email.com" value={email} onChange={e => setEmail(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          {ROLES.map(([r, label]) => (
            <button key={r} onClick={() => { setRole(r); setOrgId(""); }} className="px-2.5 py-1 rounded font-mono text-[9px] font-bold uppercase"
              style={{ background: role === r ? INK : "#F4EFE3", color: role === r ? "#fff" : "#3E3A30" }}>{label}</button>
          ))}
        </div>
        {orgType && (
          <select className={inp} style={{ borderColor: LINE }} value={orgId} onChange={e => setOrgId(e.target.value)}>
            <option value="">— pick {orgType} —</option>
            {orgList.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            <option value="__new__">+ New {orgType}…</option>
          </select>
        )}
        {orgId === "__new__" && (
          <input className={inp} style={{ borderColor: LINE }} placeholder={`New ${orgType} name (e.g. NTG Air & Ocean)`}
            value={newOrgName} onChange={e => setNewOrgName(e.target.value)} />
        )}
        <button onClick={send}
          disabled={busy || name.length < 2 || !email.includes("@") || (!!orgType && !orgId) || (orgId === "__new__" && newOrgName.length < 2)}
          className="py-2 rounded font-mono text-[10px] font-bold disabled:opacity-40" style={{ background: TEAL, color: "#fff" }}>
          {busy ? "…" : "SEND INVITE"}
        </button>
        {msg && <p className="font-mono text-[10px]" style={{ color: msg[1] ? TEAL : RED }}>{msg[0]}</p>}
      </div>
    </div>
  );
}
