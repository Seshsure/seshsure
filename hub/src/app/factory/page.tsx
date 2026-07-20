// ————— FACTORY HOME — the day at a glance —————
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase-server";
export const dynamic = "force-dynamic";

export default async function FactoryHome() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { resolveFactory } = await import("@/lib/factory-context");
  const { factoryId } = await resolveFactory(sb, user!.id);
  if (!factoryId) return null;

  const [{ data: fac }, { data: runs }, { data: claims }, { data: finv }, { data: fdocs }, { data: sigs }] = await Promise.all([
    sb.from("factories").select("name, legal_name, onboarding_complete, board_eligible, monthly_capacity_units").eq("id", factoryId).single(),
    sb.from("production_runs").select("id, status, pickup_ready_date, packing_cartons").eq("factory_id", factoryId).not("status", "in", '("closed")'),
    sb.from("disputes").select("id, factory_responded_at").not("status", "in", '("resolved","denied")'),
    sb.from("factory_invoices").select("amount_cents, paid_amount_cents, paid_at, three_way_matched").eq("factory_id", factoryId),
    sb.from("factory_documents").select("id").eq("factory_id", factoryId),
    sb.from("signatures").select("id").eq("factory_id", factoryId).limit(1),
  ]);

  const active = runs ?? [];
  const awaiting = active.filter(r => r.status === "placed").length;
  const inProd = active.filter(r => ["confirmed", "in_production"].includes(String(r.status))).length;
  const readyNoPacking = active.filter(r => !r.pickup_ready_date && ["confirmed", "in_production", "qc_approved"].includes(String(r.status))).length;
  const needResponse = (claims ?? []).filter(c => !c.factory_responded_at).length;

  const billed = (finv ?? []).reduce((s, i) => s + BigInt(i.amount_cents), 0n);
  const paid = (finv ?? []).reduce((s, i) => s + BigInt(i.paid_amount_cents ?? 0), 0n);
  const balance = billed - paid;
  const usd = (c: bigint) => "$" + (Number(c / 100n)).toLocaleString();

  const onboardingDone = !!fac?.onboarding_complete || (!!sigs?.length && !!fac?.legal_name);
  const Tile = ({ label, value, tone, href, hint }: { label: string; value: string; tone?: string; href: string; hint?: string }) => (
    <Link href={href} className="rounded-xl border-2 bg-white p-4 block" style={{ borderColor: "#181818" }}>
      <p className="eyebrow" style={{ color: "#5C574A" }}>{label}</p>
      <p className="font-mono text-[20px] font-bold mt-1" style={{ color: tone ?? "#181818" }}>{value}</p>
      {hint && <p className="font-mono text-[10px] mt-1" style={{ color: "#5C574A" }}>{hint}</p>}
    </Link>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-5">
      <h1 className="font-bold text-[16px]" style={{ color: "#181818" }}>{fac?.legal_name ?? fac?.name}</h1>

      {!onboardingDone && (
        <Link href="/factory/onboarding" className="block rounded-xl punch p-4 mt-3" style={{ background: "#FFD23F" }}>
          <p className="font-bold text-[14px]" style={{ color: "#181818" }}>Finish onboarding to unlock production →</p>
          <p className="font-mono text-[10px] mt-1" style={{ color: "#181818" }}>COMPANY · BANKING · DOCUMENTS · AGREEMENTS · SPECS — {(fdocs ?? []).length} DOCS ON FILE SO FAR</p>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 mt-4">
        <Tile label="AWAITING YOUR CONFIRMATION" value={String(awaiting)} tone={awaiting ? "#D62839" : "#0D9488"} href="/factory/runs" hint={awaiting ? "CONFIRM WITHIN 48H" : "ALL CONFIRMED"} />
        <Tile label="IN PRODUCTION" value={String(inProd)} href="/factory/runs" />
        <Tile label="NEEDS PACKING & PICKUP DATE" value={String(readyNoPacking)} tone={readyNoPacking ? "#C77800" : "#0D9488"} href="/factory/runs" hint="PACKING SHEET DRIVES SESHSURE'S PICKUP" />
        <Tile label="CLAIMS NEEDING RESPONSE" value={String(needResponse)} tone={needResponse ? "#D62839" : "#0D9488"} href="/factory/claims" />
        <Tile label="OPEN BALANCE" value={usd(balance)} tone="#181818" href="/factory/statement" hint={`BILLED ${usd(billed)} · PAID ${usd(paid)}`} />
        <Tile label="RUN BOARD" value={fac?.board_eligible ? "OPEN" : "LOCKED"} tone={fac?.board_eligible ? "#0D9488" : "#5C574A"} href="/factory/board" hint={fac?.board_eligible ? "BID ON OPEN WORK" : "OPENS AFTER QUALIFICATION RUN"} />
      </div>

      <p className="font-mono text-[10px] mt-5 leading-relaxed" style={{ color: "#5C574A" }}>
        EVERYTHING RUNS THROUGH THIS PORTAL: CONFIRM RUNS FAST, KEEP DOCUMENTS CURRENT, SUBMIT INVOICES AGAINST RUNS.
        MATCHED INVOICES PAY WITHOUT QUESTIONS — MISMATCHES WAIT FOR REVIEW.
      </p>
    </div>
  );
}
