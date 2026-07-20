import Link from "next/link";

const NAV = [
  ["/admin/goals", "GOALS"], ["/admin/clients", "CLIENTS"], ["/admin/pipeline", "PIPELINE"],
  ["/admin/batches", "BATCH"], ["/admin/disputes", "DISPUTES"], ["/admin/board", "BOARD"],
  ["/admin/factories", "FACTORIES"], ["/admin/freight", "FREIGHT"], ["/admin/factory-ledger", "LEDGER"],
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--paper)" }}>
      <header className="sticky top-0 z-10 border-b-2 px-5 py-3 flex items-center justify-between gap-6"
        style={{ background: "var(--paper)", borderColor: "var(--ink)" }}>
        <Link href="/admin" className="display display-shadow text-[16px] whitespace-nowrap" style={{ color: "var(--ink)" }}>
          SESHSURE<span style={{ color: "var(--teal)" }}>.</span>
        </Link>
        <nav className="flex gap-4 font-mono text-[9px] font-bold tracking-wider overflow-x-auto" style={{ color: "var(--mute)" }}>
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="hover:text-[#181818] py-1 whitespace-nowrap">{label}</Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
