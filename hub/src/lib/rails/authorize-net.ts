// ————— AUTHORIZE.NET RAIL — cards via stored CIM profiles —————
// accountToken format: "customerProfileId|paymentProfileId" (created at card-add).
// Sandbox/production switched by AUTHNET_ENV.
import type { PaymentRail, RailResult } from "../rail";

const ENDPOINT = () =>
  process.env.AUTHNET_ENV === "production"
    ? "https://api.authorize.net/xml/v1/request.api"
    : "https://apitest.authorize.net/xml/v1/request.api";

const auth = () => ({
  name: process.env.AUTHNET_LOGIN_ID ?? "",
  transactionKey: process.env.AUTHNET_TRANSACTION_KEY ?? "",
});

async function anetRequest(body: Record<string, unknown>): Promise<{ ok: boolean; transId?: string; message?: string }> {
  const res = await fetch(ENDPOINT(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const json = JSON.parse(text.replace(/^\uFEFF/, "")); // Authorize.net BOM quirk
  const rc = json?.messages?.resultCode;
  const tx = json?.transactionResponse;
  if (rc === "Ok" && (!tx || tx.responseCode === "1")) {
    return { ok: true, transId: tx?.transId };
  }
  const msg = tx?.errors?.[0]?.errorText ?? json?.messages?.message?.[0]?.text ?? "declined";
  return { ok: false, message: msg };
}

export class AuthorizeNetRail implements PaymentRail {
  name = "authorize.net";

  async debit(a: { paymentId: string; amountCents: bigint; accountToken: string; descriptor: string; effectiveDate?: string }): Promise<RailResult> {
    const [customerProfileId, paymentProfileId] = a.accountToken.split("|");
    if (!customerProfileId || !paymentProfileId) return { ok: false, error: "malformed account token" };
    const r = await anetRequest({
      createTransactionRequest: {
        merchantAuthentication: auth(),
        refId: a.paymentId.slice(0, 20),
        transactionRequest: {
          transactionType: "authCaptureTransaction",
          amount: (Number(a.amountCents) / 100).toFixed(2),
          profile: { customerProfileId, paymentProfile: { paymentProfileId } },
          order: { invoiceNumber: a.paymentId.slice(0, 20), description: a.descriptor },
        },
      },
    });
    return r.ok ? { ok: true, railRef: r.transId! } : { ok: false, error: r.message ?? "declined" };
  }

  async credit(a: { paymentId: string; amountCents: bigint; accountToken: string; descriptor: string }): Promise<RailResult> {
    const [customerProfileId, paymentProfileId] = a.accountToken.split("|");
    const r = await anetRequest({
      createTransactionRequest: {
        merchantAuthentication: auth(),
        refId: a.paymentId.slice(0, 20),
        transactionRequest: {
          transactionType: "refundTransaction",
          amount: (Number(a.amountCents) / 100).toFixed(2),
          profile: { customerProfileId, paymentProfile: { paymentProfileId } },
        },
      },
    });
    return r.ok ? { ok: true, railRef: r.transId! } : { ok: false, error: r.message ?? "declined" };
  }

  async microDeposits(): Promise<RailResult> {
    return { ok: true, railRef: "verification-at-onboarding" };
  }
}
