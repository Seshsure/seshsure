// ————— Money: integers only, forever —————
// Amounts: integer cents. Per-cone prices: integer microcents (1¢ = 10,000).

export type Cents = bigint;
export type Microcents = bigint;

export const MICRO_PER_CENT = 10_000n;
export const CENTS_PER_DOLLAR = 100n;

/** cones × per-cone price (microcents) → invoice cents, exact, half-up on the sub-cent remainder */
export function conesToCents(cones: bigint, perConeMicro: Microcents): Cents {
  const micro = cones * perConeMicro;
  const whole = micro / MICRO_PER_CENT;
  const rem = micro % MICRO_PER_CENT;
  return rem * 2n >= MICRO_PER_CENT ? whole + 1n : whole;
}

export function formatUSD(cents: Cents): string {
  const neg = cents < 0n;
  const abs = neg ? -cents : cents;
  const d = abs / CENTS_PER_DOLLAR;
  const c = abs % CENTS_PER_DOLLAR;
  return `${neg ? "−" : ""}$${d.toLocaleString()}.${c.toString().padStart(2, "0")}`;
}

/** display per-cone price like 6.10¢ */
export function formatPerCone(micro: Microcents): string {
  const cents = Number(micro) / Number(MICRO_PER_CENT);
  return `${cents.toFixed(2)}¢`;
}

export function pctOf(cents: Cents, bps: bigint): Cents {
  const num = cents * bps;
  const whole = num / 10_000n;
  const rem = num % 10_000n;
  return rem * 2n >= 10_000n ? whole + 1n : whole;
}
