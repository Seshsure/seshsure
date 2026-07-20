"use client";
// Resumable signup wizard shell — steps post to /api/onboarding
import { useEffect, useState } from "react";

type State = { next: string; done: string[]; client: { legal_name: string | null } } | null;

export default function Signup() {
  const [state, setState] = useState<State>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/onboarding/state").then(r => r.ok ? r.json() : null).then(s => { setState(s); setLoading(false); });
  }, []);
  const STEPS = ["company", "team", "shipping", "agreements", "payment"];
  return (
    <main className="min-h-screen" style={{ background: "#FAF5EA" }}>
      <div className="max-w-lg mx-auto px-4 py-8">
        <h1 className="font-bold text-[18px]" style={{ color: "#181818" }}>Welcome to SeshSure</h1>
        <p className="text-[11px] mt-1" style={{ color: "#514C41" }}>A few steps and you&apos;re ordering. Progress saves — leave and come back anytime.</p>
        <div className="flex gap-1 mt-4">
          {STEPS.map(s => (
            <div key={s} className="flex-1 h-1.5 rounded-full"
              style={{ background: state?.done?.includes(s) ? "#0D9488" : "#E7DFCE" }} />
          ))}
        </div>
        <div className="mt-6 rounded-xl border p-5" style={{ background: "#fff", borderColor: "#E7DFCE" }}>
          {loading ? <p className="text-[11px]" style={{ color: "#514C41" }}>Loading…</p>
            : !state ? <p className="text-[11px]" style={{ color: "#514C41" }}>Signup opens from your invite link. Check your email or contact rob@seshsure.com.</p>
            : state.next === "done" ? (
              <div className="text-center py-4">
                <p className="text-[15px] font-bold" style={{ color: "#0D9488" }}>✓ You&apos;re all set</p>
                <a href="/portal" className="inline-block mt-3 px-5 py-2.5 rounded-lg font-bold text-[12px]" style={{ background: "#181818", color: "#fff" }}>Enter your portal</a>
              </div>
            ) : (
              <p className="text-[12px]" style={{ color: "#181818" }}>
                Next step: <b>{state.next}</b> — the step forms post to /api/onboarding and resume automatically.
              </p>
            )}
        </div>
      </div>
    </main>
  );
}
