// ————— NACHA FILE BUILDER — First Citizens Bank DES spec (Rev 02/2024) —————
// Upgraded against FCB's published spec + sample file + the Nacha dev guide.
// 94-char fixed-width, CRLF endings, unbalanced (FCB manages the offset),
// 9-filled to a block of ten. Built for CCD collection batches; no addenda
// in v1 (also sidesteps an FCB-sample ambiguity on entry/addenda counts).
//
// OPEN WITH FCB (Amber) BEFORE LIVE FILES:
//   1. Company ID prefix — "Tax ID preceded by a specific value, which will
//      be provided by First Citizens Bank." Placeholder "1" per their sample.
//   2. SFTP endpoint + credentials (DES implementation, ~3 weeks).
//   3. Confirm batch-control entry/addenda count = entries only (their
//      sample shows 9 with 3 addenda present; Nacha standard counts both).
type Entry = {
  routing: string;              // full 9-digit RDFI routing — check digit validated
  account: string;
  amountCents: bigint;          // 0n for prenotes
  name: string;                 // receiving company name
  receiverId?: string;          // invoice/client number (Individual ID field)
  txCode: "27" | "22" | "23" | "28";  // CCD: debit / credit / credit prenote / debit prenote
  traceSeq: number;
};

const FCB_ROUTING = "053100300";
const FCB_ODFI_8 = "05310030";

// Spec: alphanumeric LEFT-justified space-filled; numeric RIGHT zero-filled.
const pad = (s: string, n: number) => s.toUpperCase().replace(/[^A-Z0-9 .,'&\/-]/g, " ").slice(0, n).padEnd(n, " ");
const num = (v: bigint | number, n: number) => v.toString().padStart(n, "0").slice(-n);

// Routing check digit — mod-10, weights 3-7-1 over the first eight digits.
export function routingCheckDigit(first8: string): number {
  const w = [3, 7, 1, 3, 7, 1, 3, 7];
  const sum = first8.split("").reduce((a, d, i) => a + parseInt(d, 10) * w[i], 0);
  return (10 - (sum % 10)) % 10;
}
export function validRouting(r9: string): boolean {
  return /^\d{9}$/.test(r9) && routingCheckDigit(r9.slice(0, 8)) === parseInt(r9[8], 10);
}

export function buildNacha(args: {
  entries: Entry[];
  companyName: string;
  companyId: string;            // FCB-provided prefix + EIN (10 chars)
  companyTaxId?: string;        // 9-digit EIN for the file header origin
  odfiRouting?: string;         // kept for caller compatibility; FCB constant wins
  effectiveDate: string;        // YYMMDD
  description: string;          // ≤10 chars, e.g. INVOICES
  fileIdModifier?: string;      // A–Z / 0–9, differentiates same-day files
}): string {
  const now = new Date();
  const fileDate = now.toISOString().slice(2, 10).replace(/-/g, "");
  const fileTime = now.toTimeString().slice(0, 5).replace(":", "");
  const taxId = (args.companyTaxId ?? args.companyId.replace(/\D/g, "").slice(-9)).padStart(9, "0");
  const L: string[] = [];

  for (const e of args.entries) {
    if (!validRouting(e.routing)) throw new Error(`invalid routing ${e.routing} (check digit fails)`);
    const prenote = e.txCode === "23" || e.txCode === "28";
    if (prenote && e.amountCents !== 0n) throw new Error("prenote entries must be $0");
    if (!prenote && e.amountCents <= 0n) throw new Error("live entries must be > $0");
  }
  const allDebits = args.entries.every(e => e.txCode === "27" || e.txCode === "28");
  const allCredits = args.entries.every(e => e.txCode === "22" || e.txCode === "23");
  const svc = allDebits ? "225" : allCredits ? "220" : "200";

  // 1 — File Header. Immediate Destination = bFCB routing; Immediate Origin
  // = blank then 9-digit CO TAX ID (FCB vendor doc), both 10-wide.
  L.push("101" + " " + FCB_ROUTING + " " + taxId + fileDate + fileTime +
    (args.fileIdModifier ?? "A") + "094" + "10" + "1" +
    pad("First Citizens Bank", 23) + pad(args.companyName, 23) + " ".repeat(8));

  // 5 — Batch Header (CCD; effective date per caller; ODFI = 05310030).
  L.push("5" + svc + pad(args.companyName, 16) + " ".repeat(20) + pad(args.companyId, 10) +
    "CCD" + pad(args.description, 10) + " ".repeat(6) + args.effectiveDate + " ".repeat(3) + "1" +
    FCB_ODFI_8 + num(1, 7));

  // 6 — Entry Details.
  let hash = 0n, debits = 0n, credits = 0n;
  args.entries.forEach((e) => {
    hash += BigInt(e.routing.slice(0, 8));
    if (e.txCode === "27" || e.txCode === "28") debits += e.amountCents; else credits += e.amountCents;
    L.push("6" + e.txCode + e.routing.slice(0, 8) + e.routing[8] + pad(e.account, 17) +
      num(e.amountCents, 10) + pad(e.receiverId ?? "", 15) + pad(e.name, 22) + "  " + "0" +
      FCB_ODFI_8 + num(e.traceSeq, 7));
  });
  const hash10 = num(hash % 10_000_000_000n, 10);

  // 8 — Batch Control (v1: no addenda → count = entries; see OPEN #3).
  L.push("8" + svc + num(args.entries.length, 6) + hash10 +
    num(debits, 12) + num(credits, 12) + pad(args.companyId, 10) +
    " ".repeat(19) + " ".repeat(6) + FCB_ODFI_8 + num(1, 7));

  // 9 — File Control.
  const blocks = Math.ceil((L.length + 1) / 10);
  L.push("9" + num(1, 6) + num(blocks, 6) + num(args.entries.length, 8) +
    hash10 + num(debits, 12) + num(credits, 12) + " ".repeat(39));

  while (L.length % 10 !== 0) L.push("9".repeat(94));

  for (const [i, l] of L.entries())
    if (l.length !== 94) throw new Error(`record ${i + 1} is ${l.length} chars, must be 94`);
  return L.join("\r\n") + "\r\n";
}

export function nextBankingDay(from = new Date()): string {
  const d = new Date(from);
  do { d.setUTCDate(d.getUTCDate() + 1); } while ([0, 6].includes(d.getUTCDay()));
  return d.toISOString().slice(2, 10).replace(/-/g, "");
}
