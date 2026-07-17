// AI draft endpoint — OWNER ONLY. Context is gathered server-side from the real
// record (never trusted from the browser), then drafted in the task's voice.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";
import { aiDraft, VOICES, VoiceKey } from "@/lib/ai";
import { formatUSD } from "@/lib/money";

const Body = z.object({
  task: z.enum(["dispute_client_reply", "dispute_factory_note", "collections_note", "supplier_message"]),
  entityId: z.string().uuid().optional(),     // dispute id / client id
  freeContext: z.string().max(1500).optional(), // Rob's steering note
});

export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: prof } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if (prof?.role !== "owner") return NextResponse.json({ error: "owner only" }, { status: 403 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { task, entityId, freeContext } = parsed.data;

  let context = "";
  if ((task === "dispute_client_reply" || task === "dispute_factory_note") && entityId) {
    const { data: d } = await sb.from("disputes")
      .select("dispute_number, status, issue_types, description, qty_affected_units, pct_inspected, lot_number, days_since_delivery, window_status, urgency, factory_response, root_cause, defect_scope, resolution_type, resolution_value_cents, clients(dba, legal_name), dispute_media(media_kind)")
      .eq("id", entityId).single();
    if (!d) return NextResponse.json({ error: "dispute not found" }, { status: 404 });
    const client = d.clients as unknown as { dba: string | null; legal_name: string };
    const media = (d.dispute_media ?? []) as { media_kind: string }[];
    context = `DISPUTE RECORD
Number: ${d.dispute_number} · Status: ${d.status} · Urgency: ${d.urgency}
Client: ${client.dba ?? client.legal_name}
Issues: ${(d.issue_types ?? []).join(", ")} · Lot: ${d.lot_number ?? "n/a"} · Filed day ${d.days_since_delivery ?? "?"} (${d.window_status})
Client says: "${d.description}"
Affected: ${d.qty_affected_units?.toLocaleString() ?? "?"} units · ${d.pct_inspected ?? "?"}% inspected
Evidence: ${media.filter(m => m.media_kind === "photo").length} photos, ${media.filter(m => m.media_kind === "video").length} videos
Factory response: ${d.factory_response ?? "(none yet)"}
Ruling: ${d.root_cause ? `${d.root_cause} / ${d.defect_scope} / ${d.resolution_type}${d.resolution_value_cents ? ` / ${formatUSD(BigInt(d.resolution_value_cents))}` : ""}` : "(NOT YET RULED — do not promise outcomes)"}`;
  }
  if (task === "collections_note" && entityId) {
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: client }, { data: open }] = await Promise.all([
      sb.from("clients").select("dba, legal_name").eq("id", entityId).single(),
      sb.from("invoices").select("invoice_number, total_cents, paid_cents, due_date")
        .eq("client_id", entityId).in("status", ["sent","viewed","partially_paid","overdue"]),
    ]);
    if (!client) return NextResponse.json({ error: "client not found" }, { status: 404 });
    const lines = (open ?? []).map(i => {
      const rem = BigInt(i.total_cents) - BigInt(i.paid_cents);
      const late = i.due_date && i.due_date < today ? Math.floor((Date.now() - new Date(i.due_date).getTime()) / 864e5) : 0;
      return `${i.invoice_number}: ${formatUSD(rem)} (due ${i.due_date ?? "n/a"}${late ? `, ${late}d late` : ""})`;
    });
    context = `CLIENT: ${client.dba ?? client.legal_name}\nOPEN INVOICES:\n${lines.join("\n") || "(none)"}\nPORTAL: hub.seshsure.com/portal/invoices`;
  }

  const system = VOICES[task as VoiceKey];
  const userContent = [context, freeContext ? `ROB'S STEERING NOTE: ${freeContext}` : "", "Draft the message now. Output only the message text."]
    .filter(Boolean).join("\n\n");

  const result = await aiDraft(system, userContent);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 503 });

  await sb.from("activity_log").insert({
    actor_profile_id: user.id, actor_label: "owner",
    action: `ai.drafted.${task}`, entity_table: task.startsWith("dispute") ? "disputes" : "clients",
    entity_id: entityId ?? null,
  });
  return NextResponse.json({ ok: true, draft: result.text });
}
