// PUBLIC prospect intake — no login. Honeypot + caps.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const Body = z.object({
  company: z.string().min(2).max(120),
  contactName: z.string().max(80).optional(),
  email: z.string().email(),
  phone: z.string().max(30).optional(),
  leadSource: z.string().min(2).max(80),
  notes: z.string().max(1500).optional(),
  desiredCones: z.object({
    paperType: z.string().max(60).optional(),
    colors: z.string().max(120).optional(),
  }).optional(),
  website: z.string().max(0).optional(),
  showName: z.string().max(80).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "check the form" }, { status: 400 });
  const b = parsed.data;
  if (b.website) return NextResponse.json({ ok: true });

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: p } = await sb.from("prospects").insert({
    company: b.company, contact_name: b.contactName ?? null, email: b.email,
    phone: b.phone ?? null, lead_source: b.leadSource, notes: b.notes ?? null,
    desired_cones: b.desiredCones ?? null,
    show_capture: !!b.showName, show_name: b.showName ?? null,
  }).select("id").single();

  if (p && !b.showName) {
    await sb.from("tasks").insert({
      title: `🌱 New lead: ${b.company} (${b.leadSource}) — reach out`,
      kind: "lead", related_id: p.id, auto_generated: true,
      due_on: new Date().toISOString().slice(0, 10),
    });
  }
  return NextResponse.json({ ok: true, message: "Thanks — we'll be in touch within one business day." });
}
