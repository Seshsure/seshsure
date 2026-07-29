// ————— PUBLIC ACCESS APPLICATION — apply is open, entry is not —————
// Protections on the only public write here: honeypot field, strict zod
// caps, one pending application per email (DB-enforced), and the response
// never reveals whether an email already applied. The owner gets an alert;
// nothing else happens until a human approves.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { sendTemplate } from "@/lib/email";

const Body = z.object({
  company: z.string().min(2).max(140),
  contactName: z.string().min(2).max(120),
  email: z.string().email().max(140),
  phone: z.string().max(30).optional(),
  website: z.string().max(140).optional(),
  state: z.string().max(40).optional(),
  licenseNo: z.string().max(60).optional(),
  message: z.string().max(500).optional(),
  ref: z.string().max(40).optional(),
  fax: z.string().max(0).optional(),      // honeypot: any content = bot
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success || parsed.data.fax) return NextResponse.json({ ok: true }); // silent drop
  const b = parsed.data;

  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error } = await svc.from("access_applications").insert({
    company: b.company, contact_name: b.contactName, email: b.email.toLowerCase(),
    phone: b.phone ?? null, website: b.website ?? null, state: b.state ?? null,
    license_no: b.licenseNo ?? null, message: b.message ?? null, ref_code: b.ref ?? null,
  });
  // Duplicate pending → same success response; applicants learn nothing.
  if (!error) {
    await sendTemplate({
      to: "rob@seshsure.com", templateKey: "application.received",
      vars: { company: b.company, name: b.contactName, email: b.email, ref: b.ref ?? "direct" },
      systemOverride: true, bccOwner: false,
    }).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
