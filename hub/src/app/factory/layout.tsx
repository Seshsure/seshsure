import Link from "next/link";

import { supabaseServer } from "@/lib/supabase-server";

export default async function FactoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "#FAF5EA" }}>
      {await (async () => {
        const sb = supabaseServer();
        const { data: { user } } = await sb.auth.getUser();
        const { data: prof } = user ? await sb.from("profiles").select("role").eq("id", user.id).single() : { data: null };
        return prof?.role === "owner" ? (
          <div className="px-4 py-1.5 text-center font-mono text-[11px] font-bold" style={{ background: "#FFD23F", color: "#181818" }}>
            OWNER PREVIEW — YOU ARE SEEING THE FACTORY PORTAL AS A FACTORY WOULD (FIRST FACTORY&apos;S SEAT)
          </div>
        ) : null;
      })()}
      <header className="sticky top-0 z-10 border-b px-4 py-3 flex items-center justify-between"
        style={{ background: "#FAF5EA", borderColor: "#E7DFCE" }}>
        <Link href="/factory" className="display text-[16px]" style={{ color: "#181818" }}>SESHSURE<span style={{ color: "#0D9488" }}> PRODUCTION</span>
        </Link>
        <nav className="flex gap-4 font-mono text-[12px]" style={{ color: "#3E3A30" }}>
          <Link href="/factory">HOME</Link>
          <Link href="/factory/runs">RUNS</Link>
          <Link href="/factory/board">BOARD</Link>
          <Link href="/factory/claims">CLAIMS</Link>
          <Link href="/factory/statement">STATEMENT</Link>
          <Link href="/factory/onboarding">ONBOARDING</Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
