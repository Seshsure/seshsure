"use client";
// ————— INVITE LANDING: create your password —————
// The invite link authenticated this session; this page lets the invitee
// set their own credential. Nobody else ever knows it.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function SetPassword() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();

  async function save() {
    setErr("");
    if (pw.length < 10) { setErr("Use at least 10 characters."); return; }
    if (pw !== pw2) { setErr("Passwords don't match."); return; }
    setBusy(true);
    const sb = supabaseBrowser();
    const { error } = await sb.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    router.push("/");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-5" style={{ background: "#FAF5EA" }}>
      <div className="w-full max-w-sm rounded-xl border-2 p-5 bg-white" style={{ borderColor: "#181818", boxShadow: "6px 6px 0 #181818" }}>
        <h1 className="display text-[18px]" style={{ color: "#181818" }}>CREATE YOUR PASSWORD</h1>
        <p className="text-[12px] mt-1" style={{ color: "#5C574A" }}>Welcome to the SeshSure Hub. Set your password to finish creating your account.</p>
        <input type="password" placeholder="New password (10+ characters)" value={pw} onChange={e => setPw(e.target.value)}
          className="w-full mt-3 rounded border-2 px-3 py-2 text-[13px]" style={{ borderColor: "#E7DFCE" }} />
        <input type="password" placeholder="Repeat password" value={pw2} onChange={e => setPw2(e.target.value)}
          className="w-full mt-2 rounded border-2 px-3 py-2 text-[13px]" style={{ borderColor: "#E7DFCE" }} />
        <button onClick={save} disabled={busy || !pw || !pw2}
          className="w-full mt-3 py-2.5 rounded font-mono text-[12px] font-bold disabled:opacity-40"
          style={{ background: "#181818", color: "#fff" }}>{busy ? "…" : "CREATE ACCOUNT"}</button>
        {err && <p className="font-mono text-[10px] mt-2" style={{ color: "#D62839" }}>{err}</p>}
      </div>
    </main>
  );
}
