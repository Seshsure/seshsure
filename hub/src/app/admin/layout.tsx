import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "#0C0F11" }}>
      <header className="sticky top-0 z-10 border-b px-4 py-3 flex items-center justify-between"
        style={{ background: "#0C0F11", borderColor: "#262C31" }}>
        <Link href="/admin" className="font-bold text-[14px]" style={{ color: "#E8EAEC" }}>
          SESHSURE<span style={{ color: "#2DD4BF" }}> COMMAND</span>
        </Link>
        <nav className="flex gap-3 font-mono text-[9px]" style={{ color: "#8B949C" }}>
          <Link href="/admin/goals">GOALS</Link>
          <Link href="/admin/pipeline">PIPELINE</Link>
          <Link href="/admin/batches">BATCH</Link>
          <Link href="/admin/disputes">DISPUTES</Link>
          <Link href="/admin/board">BOARD</Link>
          <Link href="/admin/factories">FACTORIES</Link>
          <Link href="/admin/freight">FREIGHT</Link>
          <Link href="/admin/factory-ledger">LEDGER</Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
