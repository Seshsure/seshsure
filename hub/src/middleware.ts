import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { AREA_ALLOWED, HOME_BY_ROLE, type Role } from "@/lib/roles";

const PUBLIC = ["/login", "/auth", "/signup", "/_next", "/favicon", "/api/public", "/api/webhooks"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (all) => {
          all.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          all.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // ————— SECOND-LOCK ENFORCEMENT —————
  // A password-only session is half a key. The access token's AMR (auth method
  // reference) must show the email code (otp) or a magic link was verified;
  // otherwise the session is parked at the code screen. No skipping the gate.
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  let otpVerified = false;
  if (token) {
    try {
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
      const methods: string[] = (payload.amr ?? []).map((m: { method: string }) => m.method);
      otpVerified = methods.includes("otp") || methods.includes("magiclink");
    } catch { otpVerified = false; }
  }
  if (!otpVerified) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("step", "code");
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const { data: prof } = await supabase
    .from("profiles").select("role,is_active,client_id").eq("id", user.id).single();

  // ————— ONBOARDING GATE —————
  // Clients don't enter the portal until their company has a signed, current
  // Master Sales Agreement. The wizard at /signup collects it with evidence.
  if (prof?.role === "client" && prof.client_id && !pathname.startsWith("/signup") && !pathname.startsWith("/api/onboarding")) {
    const { data: signed } = await supabase
      .from("signatures")
      .select("id, agreement_versions!inner(doc_key)")
      .eq("client_id", prof.client_id)
      .eq("agreement_versions.doc_key", "master_sales")
      .limit(1);
    if (!signed?.length) {
      const url = req.nextUrl.clone();
      url.pathname = "/signup";
      return NextResponse.redirect(url);
    }
  }

  if (!prof?.is_active) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "inactive");
    return NextResponse.redirect(url);
  }

  const role = prof.role as Role;
  const area = "/" + (pathname.split("/")[1] ?? "");
  const allowed = AREA_ALLOWED[area];
  if (allowed && !allowed.includes(role)) {
    const url = req.nextUrl.clone();
    url.pathname = HOME_BY_ROLE[role];
    return NextResponse.redirect(url);
  }
  if (pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = HOME_BY_ROLE[role];
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
