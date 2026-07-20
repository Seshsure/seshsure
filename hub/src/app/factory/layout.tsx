import Link from "next/link";

export default function FactoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "#FAF5EA" }}>
      <header className="sticky top-0 z-10 border-b px-4 py-3 flex items-center justify-between"
        style={{ background: "#FAF5EA", borderColor: "#E7DFCE" }}>
        <Link href="/factory" className="display text-[14px]" style={{ color: "#181818" }}>SESHSURE<span style={{ color: "#0D9488" }}> PRODUCTION</span>
        </Link>
        <nav className="flex gap-4 font-mono text-[10px]" style={{ color: "#514C41" }}>
          <Link href="/factory/runs">RUNS</Link>
          <Link href="/factory/board">BOARD</Link>
          <Link href="/factory/claims">CLAIMS</Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
