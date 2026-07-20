import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "#0C0F11" }}>
      <header className="sticky top-0 z-10 border-b px-4 py-3 flex items-center justify-between"
        style={{ background: "#0C0F11", borderColor: "#262C31" }}>
        <Link href="/admin" className="font-bold text-[14px]" style={{ color: "#E8EAEC" }}>
          SESHSURE<span style={{ color: "#2DD4BF" }}> COMMAND</span>
        </Link>
        <nav className="flex gap-4 font-mono text-[9px] tracking-wider overflow-x-auto" style={{ color: "#8B949C" }}>
          <Link href="/admin/goals" className="hover:text-[#E8EAEC] py-1 whitespace-nowrap">GOALS</Link>
          <Link href="/admin/clients" className="hover:text-[#E8EAEC] py-1 whitespace-nowrap">CLIENTS</Link>
          <Link href="/admin/pipeline" className="hover:text-[#E8EAEC] py-1 whitespace-nowrap">PIPELINE</Link>
          <Link href="/admin/batches" className="hover:text-[#E8EAEC] py-1 whitespace-nowrap">BATCH</Link>
          <Link href="/admin/disputes" className="hover:text-[#E8EAEC] py-1 whitespace-nowrap">DISPUTES</Link>
          <Link href="/admin/board" className="hover:text-[#E8EAEC] py-1 whitespace-nowrap">BOARD</Link>
          <Link href="/admin/factories" className="hover:text-[#E8EAEC] py-1 whitespace-nowrap">FACTORIES</Link>
          <Link href="/admin/freight" className="hover:text-[#E8EAEC] py-1 whitespace-nowrap">FREIGHT</Link>
          <Link href="/admin/factory-ledger" className="hover:text-[#E8EAEC] py-1 whitespace-nowrap">LEDGER</Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
