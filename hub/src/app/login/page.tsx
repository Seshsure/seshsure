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
    <main className="min-h-screen flex flex-col items-center justify-center px-8" style={{ background: "#0C0F11" }}>
      <h1 className="text-3xl font-bold" style={{ color: "#E8EAEC" }}>
        SESHSURE<span style={{ color: "#2DD4BF" }}> HUB</span>
      </h1>
      <p className="font-mono text-[9px] tracking-[2px] mt-2 mb-7" style={{ color: "#5C666D" }}>PUFF · PEEL · PASS ™</p>

      <div className="w-full max-w-[330px] rounded-xl p-5" style={{ background: "#14181B", border: "1px solid #262C31" }}>
        {mode !== "otp" ? (
          <>
            <label className="font-mono text-[9px] tracking-wide" style={{ color: "#8B949C" }}>EMAIL</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email"
              className="font-mono w-full mt-1 mb-3 px-3 py-2.5 rounded-md text-[13px]"
              style={{ background: "#0C0F11", border: "1px solid #262C31", color: "#E8EAEC" }} />
            {mode === "password" && (
              <>
                <label className="font-mono text-[9px] tracking-wide" style={{ color: "#8B949C" }}>PASSWORD</label>
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password"
                  className="font-mono w-full mt-1 px-3 py-2.5 rounded-md text-[13px]"
                  style={{ background: "#0C0F11", border: "1px solid #262C31", color: "#E8EAEC" }} />
              </>
            )}
            <button onClick={signIn} disabled={busy || !email}
              className="w-full mt-4 py-3 rounded-md font-bold text-[14px] disabled:opacity-50"
              style={{ background: "#2DD4BF", color: "#0C0F11" }}>
              {busy ? "…" : mode === "password" ? "Sign in" : "Email me a sign-in link"}
            </button>
            <button onClick={() => setMode(mode === "password" ? "link" : "password")}
              className="font-mono w-full text-center mt-3 text-[10px]" style={{ color: "#8B949C" }}>
              {mode === "password" ? "EMAIL ME A SIGN-IN LINK INSTEAD" : "USE PASSWORD INSTEAD"}
            </button>
          </>
        ) : (
          <OtpEntry onSubmit={verifyOtp} busy={busy} />
        )}
        {msg && <p className="font-mono mt-3 text-[10px]" style={{ color: "#F5B84B" }}>{msg}</p>}
      </div>
      <p className="font-mono text-[9px] mt-6" style={{ color: "#5C666D" }}>SUPPORT@SESHSURE.COM</p>
    </main>
  );
}

function OtpEntry({ onSubmit, busy }: { onSubmit: (c: string) => void; busy: boolean }) {
  const [code, setCode] = useState("");
  return (
    <>
      <label className="font-mono text-[9px] tracking-wide" style={{ color: "#8B949C" }}>6-DIGIT CODE FROM YOUR EMAIL</label>
      <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric" autoFocus
        className="font-mono w-full mt-1 px-3 py-3 rounded-md text-[22px] text-center tracking-[8px]"
        style={{ background: "#0C0F11", border: "1px solid #262C31", color: "#E8EAEC" }} />
      <button onClick={() => onSubmit(code)} disabled={busy || code.length !== 6}
        className="w-full mt-4 py-3 rounded-md font-bold text-[14px] disabled:opacity-50"
        style={{ background: "#2DD4BF", color: "#0C0F11" }}>
        {busy ? "…" : "Verify & enter"}
      </button>
    </>
  );
}
