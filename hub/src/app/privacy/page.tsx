// ————— PUBLIC PRIVACY POLICY —————
// Written to be true, not boilerplate: what the Hub actually collects and
// why, named categories of service providers, no-sale statement, Colorado
// Privacy Act rights. Flagged for counsel review in BUILD-LIST P0.
const INK = "#181818";

export const metadata = { title: "Privacy Policy — SeshSure Hub" };

const S = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <section className="mt-6">
    <h2 className="display text-[15px]" style={{ color: INK }}>{t}</h2>
    <div className="text-[13px] leading-relaxed mt-1.5" style={{ color: "#3E3A30" }}>{children}</div>
  </section>
);

export default function Privacy() {
  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <h1 className="display text-[24px]" style={{ color: INK }}>PRIVACY POLICY</h1>
      <p className="font-mono text-[10px] mt-1" style={{ color: "#5C574A" }}>
        SESHSURE HUB · EFFECTIVE JULY 28, 2026 · VIDO MANUFACTURING AND DISTRIBUTION CORP D/B/A SESHSURE
      </p>

      <S t="1. WHO WE ARE">
        The SeshSure Hub is a business-to-business platform operated by Vido Manufacturing and
        Distribution Corp d/b/a SeshSure. It serves wholesale clients, manufacturing partners, and
        logistics providers. It is not directed to consumers or to anyone under 18.
      </S>

      <S t="2. WHAT WE COLLECT">
        <b>Account information:</b> name, business email, phone, role, and company affiliation.{" "}
        <b>Business records:</b> orders, invoices, payments, shipments, agreements, and related
        documents you or your company submit. <b>Payment details:</b> bank information provided for
        ACH is handled through our payment providers; we do not store full card numbers.{" "}
        <b>Technical data:</b> sign-in events and security logs (including IP address) needed to keep
        accounts safe. We collect no advertising identifiers and run no third-party ad trackers.
      </S>

      <S t="3. HOW WE USE IT">
        To operate the Hub and perform our contracts with your company: authenticating you, processing
        orders and payments, generating documents, coordinating manufacturing and freight, sending
        transactional messages (invoices, receipts, payment reminders, shipment updates), maintaining
        our books, and protecting the platform. If you opt in to operational alerts such as reorder
        reminders, every such email includes a working unsubscribe.
      </S>

      <S t="4. WHAT WE DON'T DO">
        We do not sell personal information. We do not share it for cross-context behavioral
        advertising. We do not use your business data to train third-party AI models.
      </S>

      <S t="5. WHO WE SHARE WITH">
        Service providers that run our infrastructure under contract: cloud hosting and database
        services, email delivery, payment processing, e-signature, and logistics carriers — each
        receiving only what their function requires. We may disclose information if required by law,
        to enforce agreements, or in connection with a corporate transaction, with notice where
        legally possible.
      </S>

      <S t="6. SECURITY">
        Access to Hub data is role-restricted and enforced at the database layer; every account
        sign-in requires a one-time email code in addition to credentials; data is encrypted in
        transit; and administrative actions are logged. No system is perfectly secure, but security
        is a design requirement here, not an afterthought.
      </S>

      <S t="7. RETENTION">
        We keep business records as long as needed to serve your company and to meet legal, tax, and
        accounting obligations, then delete or de-identify them. Account information is deactivated
        when access ends and removed when no longer required for the above.
      </S>

      <S t="8. YOUR RIGHTS">
        Depending on your state (including under the Colorado Privacy Act), you may have rights to
        access, correct, or delete personal information, and to opt out of certain processing. To
        exercise them, email support@seshsure.com from your account address; we will verify and
        respond within the time the law requires. We do not discriminate for exercising rights.
      </S>

      <S t="9. CHANGES">
        We may update this policy; the effective date above will change when we do. Material changes
        will be communicated to account holders.
      </S>

      <S t="10. CONTACT">
        Vido Manufacturing and Distribution Corp d/b/a SeshSure · 10940 S. Parker Rd, Suite 788,
        Parker, CO 80134 · support@seshsure.com
      </S>
    </div>
  );
}
