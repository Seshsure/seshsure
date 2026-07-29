"use client";
// Verification signals surfaced, decision in one tap. Approve routes
// through /api/admin/applications which creates client + standard invite.
import { useState } from "react";
import { useRouter } from "next/navigation";

const INK = "#181818", TEAL = "#0D9488", RED = "#D62839", LINE = "#E7DFCE", ORANGE = "#B45309";

type App = {
  id: string; company: string; contact_name: string; email: string;
  phone: string | null; website: string | null; state: string | null;
  license_no: string | null; message: string | null; ref_code: string | null; created_at: string;
};

const FREEMAIL = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com", "proton.me", "protonmail.com"];

export function ApplicationCard({ app }: { app: App }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();

  const emailDomain = app.email.split("@")[1]?.toLowerCase() ?? "";
  const siteDomain = (app.website ?? "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const freemail = FREEMAIL.includes(emailDomain);
  const domainMatch = !!siteDomain && (emailDomain === siteDomain || emailDomain.endsWith("." + siteDomain));

  async function decide(action: "approve" | "deny") {
    setErr(""); setBusy(true);
    const res = await fetch("/api/admin/applications", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ applicationId: app.id, action }) });
    setBusy(false);
    if (!res.ok) { setErr((await res.json()).error ?? "failed"); return; }
    router.refresh();
  }

  const chip = (label: string, good: boolean | null) => (
    <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded mr-1.5"
      style={{ background: good === null ? "#F4EFE3" : good ? "#0D948815" : "#B4530915",
        color: good === null ? "#5C574A" : good ? TEAL : ORANGE }}>{label}</span>
  );

  return (
    <div className="rounded-lg border-2 p-3 mb-3 bg-white" style={{ borderColor: LINE }}>
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-bold" style={{ color: INK }}>{app.company}</p>
        <p className="font-mono text-[9px]" style={{ color: "#5C574A" }}>{app.created_at.slice(0, 10)}{app.ref_code ? ` · ref:${app.ref_code}` : ""}</p>
      </div>
      <p className="font-mono text-[10px] mt-0.5" style={{ color: "#5C574A" }}>
        {app.contact_name} · {app.email}{app.phone ? ` · ${app.phone}` : ""}{app.state ? ` · ${app.state}` : ""}
      </p>
      <div className="mt-1.5">
        {chip(freemail ? "FREE EMAIL" : `@${emailDomain}`, freemail ? false : null)}
        {app.website ? chip(domainMatch ? "DOMAIN MATCHES SITE" : `SITE: ${siteDomain}`, domainMatch ? true : null) : chip("NO WEBSITE", false)}
        {app.license_no ? chip(`LICENSE ${app.license_no}`, true) : chip("NO LICENSE GIVEN", null)}
      </div>
      {app.message && <p className="text-[12px] mt-2 italic" style={{ color: "#3E3A30" }}>&ldquo;{app.message}&rdquo;</p>}
      <div className="flex gap-2 mt-2.5">
        <button onClick={() => decide("approve")} disabled={busy}
          className="grow py-2 rounded font-mono text-[10px] font-bold disabled:opacity-40" style={{ background: TEAL, color: "#fff" }}>
          {busy ? "…" : "APPROVE + INVITE"}
        </button>
        <button onClick={() => decide("deny")} disabled={busy}
          className="px-4 py-2 rounded font-mono text-[10px] font-bold disabled:opacity-40"
          style={{ background: "#fff", color: RED, border: `2px solid ${RED}` }}>DENY</button>
      </div>
      {err && <p className="font-mono text-[10px] mt-1" style={{ color: RED }}>{err}</p>}
    </div>
  );
}
