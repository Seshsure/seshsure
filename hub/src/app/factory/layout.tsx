import Link from "next/link";

export default function FactoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "#F4F2ED" }}>
      <header className="sticky top-0 z-10 border-b px-4 py-3 flex items-center justify-between"
        style={{ background: "#F4F2ED", borderColor: "#E4E1DA" }}>
        <Link href="/factory" className="font-bold text-[15px]" style={{ color: "#15181A" }}>
          SESHSURE<span style={{ color: "#0D9488" }}> PRODUCTION</span>
        </Link>
        <nav className="flex gap-4 font-mono text-[10px]" style={{ color: "#6E756B" }}>
          <Link href="/factory/runs">RUNS</Link>
          <Link href="/factory/board">BOARD</Link>
          <Link href="/factory/claims">CLAIMS</Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
