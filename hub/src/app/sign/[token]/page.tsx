import { SignForm } from "@/components/SignForm";
export const dynamic = "force-dynamic";
export default function SignPage({ params }: { params: { token: string } }) {
  return (
    <div className="min-h-screen py-10 px-4" style={{ background: "var(--paper)" }}>
      <div className="max-w-2xl mx-auto">
        <p className="display display-shadow text-[22px]" style={{ color: "var(--ink)" }}>SESHSURE<span style={{ color: "var(--teal)" }}>.</span></p>
        <SignForm token={params.token} />
      </div>
    </div>
  );
}
