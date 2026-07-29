"use client";
// ————— TEAM MANAGER — shared by portal / factory / freightdesk —————
// Roster comes from the server page (RLS: same-org only). Invites and
// status changes go through /api/org/team, which is escalation-proof
// server-side; the role options here are convenience, not the boundary.
import { useState } from "react";
import { useRouter } from "next/navigation";

const INK = "#181818", TEAL = "#0D9488", LINE = "#E7DFCE", RED = "#D62839";

type Member = { id: string; full_name: string | null; email: string | null; role: string; is_active: boolean };

export function TeamManager({ members, roleOptions, selfId, canManage }: {
  members: Member[]; roleOptions: [string, string][]; selfId: string; canManage: boolean;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState(roleOptions[0]?.[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();

  async function act(body: object) {
    setErr(""); setBusy(true);
    const res = await fetch("/api/org/team", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { setErr((await res.json()).error ?? "failed"); return false; }
    router.refresh(); return true;
  }

  return (
    <div>
      {members.map(m => (
        <div key={m.id} className="flex items-center justify-between rounded border-2 p-2.5 mb-2 bg-white" style={{ borderColor: LINE, opacity: m.is_active ? 1 : 0.55 }}>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold truncate" style={{ color: INK }}>
              {m.full_name ?? m.email}{m.id === selfId ? " (you)" : ""}
            </p>
            <p className="font-mono text-[9px]" style={{ color: "#5C574A" }}>
              {m.email} · {m.role.replace(/_/g, " ").toUpperCase()}{m.is_active ? "" : " · DEACTIVATED"}
            </p>
          </div>
          {canManage && m.id !== selfId && (
            <button onClick={() => act({ action: m.is_active ? "deactivate" : "reactivate", profileId: m.id })} disabled={busy}
              className="shrink-0 px-2.5 py-1 rounded font-mono text-[9px] font-bold"
              style={{ background: m.is_active ? "#fff" : INK, color: m.is_active ? RED : "#fff", border: `2px solid ${m.is_active ? RED : INK}` }}>
              {m.is_active ? "DEACTIVATE" : "REACTIVATE"}
            </button>
          )}
        </div>
      ))}

      {canManage && (
        <div className="rounded-lg border-2 p-3 mt-3" style={{ borderColor: LINE, background: "#fff" }}>
          <p className="font-mono text-[10px] font-bold" style={{ color: "#3E3A30" }}>INVITE A TEAMMATE</p>
          <p className="font-mono text-[9px] mt-0.5" style={{ color: "#5C574A" }}>
            They get an email, set their own password, and see only what their role allows.
          </p>
          <div className="flex flex-col gap-2 mt-2">
            <input className="rounded border-2 px-2 py-1.5 text-[13px]" style={{ borderColor: LINE }} placeholder="Full name"
              value={name} onChange={e => setName(e.target.value)} />
            <input className="rounded border-2 px-2 py-1.5 text-[13px]" style={{ borderColor: LINE }} placeholder="work@email.com"
              value={email} onChange={e => setEmail(e.target.value)} />
            <div className="flex gap-1.5">
              {roleOptions.map(([r, label]) => (
                <button key={r} onClick={() => setRole(r)} className="px-2.5 py-1 rounded font-mono text-[9px] font-bold uppercase"
                  style={{ background: role === r ? INK : "#F4EFE3", color: role === r ? "#fff" : "#3E3A30" }}>{label}</button>
              ))}
            </div>
            <button onClick={async () => { if (await act({ action: "invite", email, fullName: name, role })) { setEmail(""); setName(""); } }}
              disabled={busy || !email.includes("@") || name.length < 2}
              className="py-2 rounded font-mono text-[10px] font-bold disabled:opacity-40" style={{ background: TEAL, color: "#fff" }}>
              {busy ? "…" : "SEND INVITE"}
            </button>
            {err && <p className="font-mono text-[10px]" style={{ color: RED }}>{err}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
