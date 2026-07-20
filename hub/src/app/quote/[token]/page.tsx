import { QuoteForm } from "@/components/ForwarderQuoteForm";
export const dynamic = "force-dynamic";
export default function QuotePage({ params }: { params: { token: string } }) {
  return (
    <div className="min-h-screen py-10 px-4" style={{ background: "var(--paper)" }}>
      <div className="max-w-xl mx-auto">
        <p className="display display-shadow text-[22px]" style={{ color: "var(--ink)" }}>SESHSURE<span style={{ color: "var(--teal)" }}>.</span></p>
        <p className="eyebrow mt-1" style={{ color: "#3E3A30" }}>FREIGHT QUOTE REQUEST</p>
        <QuoteForm token={params.token} />
      </div>
    </div>
  );
}
