// ————— PUBLIC TERMS OF USE — portal access terms —————
// Deliberately narrow: these govern USE OF THE HUB. All commercial terms
// (orders, pricing, payment, liability for goods) live in the signed MSA,
// and the precedence clause here says so — a public page can never
// contradict what clients actually signed. Flagged for counsel review in
// BUILD-LIST P0; content follows standard B2B portal practice.
const INK = "#181818";

export const metadata = { title: "Terms of Use — SeshSure Hub" };

const S = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <section className="mt-6">
    <h2 className="display text-[15px]" style={{ color: INK }}>{t}</h2>
    <div className="text-[13px] leading-relaxed mt-1.5" style={{ color: "#3E3A30" }}>{children}</div>
  </section>
);

export default function Terms() {
  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <h1 className="display text-[24px]" style={{ color: INK }}>TERMS OF USE</h1>
      <p className="font-mono text-[10px] mt-1" style={{ color: "#5C574A" }}>
        SESHSURE HUB · EFFECTIVE JULY 28, 2026 · VIDO MANUFACTURING AND DISTRIBUTION CORP D/B/A SESHSURE
      </p>

      <S t="1. WHAT THESE TERMS COVER">
        These Terms govern access to and use of the SeshSure Hub at hub.seshsure.com (the &quot;Hub&quot;),
        operated by Vido Manufacturing and Distribution Corp d/b/a SeshSure (&quot;SeshSure,&quot; &quot;we,&quot; &quot;us&quot;).
        By signing in or using the Hub you agree to these Terms.
      </S>

      <S t="2. YOUR AGREEMENTS COME FIRST">
        If you or your company has signed a Master Sales Agreement, supply agreement, or any other
        written contract with SeshSure, that contract governs the commercial relationship — orders,
        pricing, payment, delivery, warranties, and liability for goods. If these Terms conflict with
        a signed agreement, the signed agreement wins. These Terms only cover use of the Hub itself.
      </S>

      <S t="3. ACCOUNTS">
        Hub accounts are issued by SeshSure to authorized representatives of clients, manufacturing
        partners, and logistics providers. You are responsible for keeping your credentials
        confidential and for activity under your account. Tell us immediately at support@seshsure.com
        if you believe your account has been compromised. We may suspend or revoke access at any time
        to protect the Hub or its users.
      </S>

      <S t="4. ACCEPTABLE USE">
        Use the Hub only for its intended business purposes. Do not attempt to access data that is not
        yours, probe or circumvent security controls, interfere with the Hub&apos;s operation, scrape or
        harvest data, or use the Hub for any unlawful purpose. Access is role-based: what you can see
        is what you are authorized to see.
      </S>

      <S t="5. YOUR CONTENT AND DATA">
        You retain ownership of the business information you submit to the Hub. You grant SeshSure the
        right to use it to operate the Hub and perform our agreements with you — processing orders,
        producing documents, coordinating logistics, and maintaining records. Our handling of personal
        information is described in the <a href="/privacy" style={{ color: INK, textDecoration: "underline" }}>Privacy Policy</a>.
      </S>

      <S t="6. OUR PROPERTY">
        The Hub — its software, design, text, graphics, and trademarks including SeshSure and
        Puff. Peel. Pass.™ — belongs to SeshSure and its licensors. These Terms grant you a limited,
        revocable, non-transferable right to use the Hub; they transfer no other rights.
      </S>

      <S t="7. SERVICE AS-IS">
        The Hub is provided &quot;as is&quot; and &quot;as available.&quot; We work to keep it accurate, secure, and
        online, but we do not warrant uninterrupted or error-free operation. Information in the Hub
        (balances, dates, tracking) is provided for convenience; official records are maintained in
        our books and your signed agreements.
      </S>

      <S t="8. LIMITATION OF LIABILITY">
        To the fullest extent permitted by law, SeshSure&apos;s total liability arising out of use of the
        Hub itself is limited to one hundred dollars (US $100), and we are not liable for indirect,
        incidental, or consequential damages arising from Hub use. This section does not limit
        liability under any signed commercial agreement, which is governed by its own terms.
      </S>

      <S t="9. CHANGES">
        We may update these Terms; the effective date above will change when we do. Continued use of
        the Hub after an update is acceptance of the updated Terms.
      </S>

      <S t="10. GOVERNING LAW">
        These Terms are governed by the laws of the State of Colorado, without regard to conflicts of
        law principles. Venue for disputes arising under these Terms lies in the state courts of
        Douglas County, Colorado.
      </S>

      <S t="11. CONTACT">
        Vido Manufacturing and Distribution Corp d/b/a SeshSure · 10940 S. Parker Rd, Suite 788,
        Parker, CO 80134 · support@seshsure.com
      </S>
    </div>
  );
}
