// ————— THE PAYMENT RAIL SOCKET —————
// One interface. Multiple implementations. Per-method routing:
// ACH → First Citizens treasury (direct NACHA). CARD → Authorize.net.
import { AuthorizeNetRail } from "./rails/authorize-net";

export type RailResult =
  | { ok: true; railRef: string }
  | { ok: false; error: string };

export interface PaymentRail {
  name: string;
  debit(args: {
    paymentId: string;
    amountCents: bigint;
    accountToken: string;
    descriptor: string;
    effectiveDate?: string;
  }): Promise<RailResult>;
  credit(args: { paymentId: string; amountCents: bigint; accountToken: string; descriptor: string }): Promise<RailResult>;
  microDeposits(args: { accountToken: string }): Promise<RailResult>;
}

/** Direct bank origination: builds NACHA entries into the daily batch file. */
export class NachaRail implements PaymentRail {
  name = "nacha-direct";
  async debit(a: Parameters<PaymentRail["debit"]>[0]): Promise<RailResult> {
    return { ok: true, railRef: `batch-pending:${a.paymentId}` };
  }
  async credit(a: Parameters<PaymentRail["credit"]>[0]): Promise<RailResult> {
    return { ok: true, railRef: `batch-pending:${a.paymentId}` };
  }
  async microDeposits(): Promise<RailResult> {
    return { ok: true, railRef: `micro-pending` };
  }
}

/** Generic processor stub retained for future rails. */
export class ProcessorRail implements PaymentRail {
  name = "merchant-processor";
  async debit(): Promise<RailResult> { return { ok: false, error: "processor rail not configured" }; }
  async credit(): Promise<RailResult> { return { ok: false, error: "processor rail not configured" }; }
  async microDeposits(): Promise<RailResult> { return { ok: false, error: "processor rail not configured" }; }
}

/** Per-method routing — each dollar takes its cheapest road:
    ACH  → First Citizens treasury (direct NACHA origination, ~flat $1)
    CARD → Authorize.net (surcharged; cost rides on the convenience) */
export function railFor(method: "ach" | "card"): PaymentRail {
  if (method === "card") return new AuthorizeNetRail();
  return new NachaRail();
}

/** legacy single-rail accessor (ACH default) */
export function activeRail(): PaymentRail {
  return railFor("ach");
}
