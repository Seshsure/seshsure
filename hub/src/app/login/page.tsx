"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "link" | "otp">("password");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sb = supabaseBrowser();

  async function signIn() {
    setBusy(true); setMsg(null);
    if (mode === "password") {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) { setMsg(error.message); setBusy(false); return; }
      await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      setMode("otp");
      setMsg("Code sent — check your email.");
    } else {
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: `${location.origin}/auth/callback` },
      });
      setMsg(error ? error.message : "Sign-in link sent — check your email.");
    }
    setBusy(false);
  }

  async function verifyOtp(code: string) {
    setBusy(true);
    const { error } = await sb.auth.verifyOtp({ email, token: code, type: "email" });
    if (error) { setMsg(error.message); setBusy(false); return; }
    location.href = "/";
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-8" style={{ background: "var(--paper)", position: "relative", overflow: "hidden" }}>
      <svg width="70" height="18" viewBox="0 0 70 18" style={{ position: "absolute", top: 34, left: 28, opacity: .9 }}><path d="M2 9 Q 10 1, 18 9 T 34 9 T 50 9 T 66 9" stroke="#F4845F" strokeWidth="3.5" fill="none" strokeLinecap="round"/></svg>
      <div style={{ position: "absolute", bottom: 44, right: 36, width: 16, height: 16, borderRadius: 99, border: "3.5px solid #6C4AB6" }} />
      <h1 className="display display-shadow text-3xl" style={{ color: "#181818" }}>
        SESHSURE<span style={{ color: "#0D9488" }}> HUB</span>
      </h1>
      <p className="font-mono text-[11px] tracking-[2px] mt-2 mb-7" style={{ color: "#5C574A" }}>PUFF · PEEL · PASS ™</p>

      <div className="w-full max-w-[330px] rounded-xl p-5" style={{ background: "#FFFFFF", border: "1px solid #E7DFCE" }}>
        {mode !== "otp" ? (
          <>
            <label className="font-mono text-[11px] tracking-wide" style={{ color: "#3E3A30" }}>EMAIL</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email"
              className="font-mono w-full mt-1 mb-3 px-3 py-2.5 rounded-md text-[15px]"
              style={{ background: "#FAF5EA", border: "1px solid #E7DFCE", color: "#181818" }} />
            {mode === "password" && (
              <>
                <label className="font-mono text-[11px] tracking-wide" style={{ color: "#3E3A30" }}>PASSWORD</label>
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password"
                  className="font-mono w-full mt-1 px-3 py-2.5 rounded-md text-[15px]"
                  style={{ background: "#FAF5EA", border: "1px solid #E7DFCE", color: "#181818" }} />
              </>
            )}
            <button onClick={signIn} disabled={busy || !email}
              className="w-full mt-4 py-3 rounded-md font-bold text-[16px] disabled:opacity-50"
              style={{ background: "#0D9488", color: "#FAF5EA" }}>
              {busy ? "…" : mode === "password" ? "Sign in" : "Email me a sign-in link"}
            </button>
            <button onClick={() => setMode(mode === "password" ? "link" : "password")}
              className="font-mono w-full text-center mt-3 text-[12px]" style={{ color: "#3E3A30" }}>
              {mode === "password" ? "EMAIL ME A SIGN-IN LINK INSTEAD" : "USE PASSWORD INSTEAD"}
            </button>
          </>
        ) : (
          <OtpEntry onSubmit={verifyOtp} busy={busy} />
        )}
        {msg && <p className="font-mono mt-3 text-[12px]" style={{ color: "#C77800" }}>{msg}</p>}
      </div>
      <p className="font-mono text-[11px] mt-6" style={{ color: "#5C574A" }}>SUPPORT@SESHSURE.COM</p>
    </main>
  );
}

function OtpEntry({ onSubmit, busy }: { onSubmit: (c: string) => void; busy: boolean }) {
  const [code, setCode] = useState("");
  return (
    <>
      <label className="font-mono text-[11px] tracking-wide" style={{ color: "#3E3A30" }}>6-DIGIT CODE FROM YOUR EMAIL</label>
      <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric" autoFocus
        className="font-mono w-full mt-1 px-3 py-3 rounded-md text-[22px] text-center tracking-[8px]"
        style={{ background: "#FAF5EA", border: "1px solid #E7DFCE", color: "#181818" }} />
      <button onClick={() => onSubmit(code)} disabled={busy || code.length !== 6}
        className="w-full mt-4 py-3 rounded-md font-bold text-[16px] disabled:opacity-50"
        style={{ background: "#0D9488", color: "#FAF5EA" }}>
        {busy ? "…" : "Verify & enter"}
      </button>
    </>
  );
}
