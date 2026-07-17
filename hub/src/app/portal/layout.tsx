import Link from "next/link";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "#F4F2ED" }}>
      <header className="sticky top-0 z-10 border-b px-4 py-3 flex items-center justify-between"
        style={{ background: "#F4F2ED", borderColor: "#E4E1DA" }}>
        <Link href="/portal" className="font-bold text-[15px]" style={{ color: "#15181A" }}>
          SESHSURE<span style={{ color: "#0D9488" }}> HUB</span>
        </Link>
        <nav className="flex gap-4 font-mono text-[10px]" style={{ color: "#6E756B" }}>
          <Link href="/portal/invoices">INVOICES</Link>
          <Link href="/portal/orders/new">ORDER</Link>
          <Link href="/portal/tracking">TRACKING</Link>
          <Link href="/portal/money">MONEY</Link>
        </nav>
      </header>
      {children}
      <footer className="px-4 py-8 text-center font-mono text-[8px]" style={{ color: "#9B9F98" }}>
        VIDO MANUFACTURING AND DISTRIBUTION CORP D/B/A SESHSURE · PARKER, CO · SUPPORT@SESHSURE.COM
      </footer>
    </div>
  );
}
