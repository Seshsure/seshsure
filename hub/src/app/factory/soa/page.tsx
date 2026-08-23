// ————— FACTORY SOA — their live statement, line-confirmable —————
import { supabaseServer } from "@/lib/supabase-server";
import { SoaStatement, type SoaLine } from "@/components/SoaStatement";
import { SoaSubmit } from "@/components/SoaSubmit";

export const dynamic = "force-dynamic";

export default async function FactorySoa() {
  const sb = supabaseServer();
  const { data: lines } = await sb.from("factory_statement_lines")
    .select("id, entry_date, kind, billing_entity, ref_no, description, total_cents, factory_confirmed_at, dispute_note, attachment_path, status, reject_note")
    .order("entry_date").order("created_at");
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="display text-[22px]" style={{ color: "#181818" }}>STATEMENT OF ACCOUNT</h1>
      <p className="font-mono text-[10px] mt-1 mb-4" style={{ color: "#5C574A" }}>
        LIVE · BOTH SIDES SEE THE SAME NUMBERS · CONFIRM EACH LINE OR DISPUTE WITH A NOTE
      </p>
      <SoaSubmit />
      <SoaStatement lines={(lines ?? []) as SoaLine[]} side="factory" />
    </div>
  );
}
