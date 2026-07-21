import Link from "next/link";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "#FAF5EA" }}>
      <header className="sticky top-0 z-10 border-b px-4 py-3 flex items-center justify-between"
        style={{ background: "#FAF5EA", borderColor: "#E7DFCE" }}>
        <Link href="/portal" className="display text-[16px]" style={{ color: "#181818" }}>SESHSURE<span style={{ color: "#0D9488" }}> HUB</span>
        </Link>
        <nav className="flex gap-4 font-mono text-[12px]" style={{ color: "#3E3A30" }}>
          <Link href="/portal/invoices">INVOICES</Link>
          <Link href="/portal/orders/new">ORDER</Link>
          <Link href="/portal/tracking">TRACKING</Link>
          <Link href="/portal/money">MONEY</Link>
          <Link href="/portal/disputes">CLAIMS</Link>
        </nav>
      </header>
      {children}
      <footer className="px-4 py-8 text-center font-mono text-[10px]" style={{ color: "#5C574A" }}>
        VIDO MANUFACTURING AND DISTRIBUTION CORP D/B/A SESHSURE · PARKER, CO · SUPPORT@SESHSURE.COM
      </footer>
    </div>
  );
}
