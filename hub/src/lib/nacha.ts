// NACHA file builder — direct-rail implementation. Fixed-width, bank-grade.
type Entry = {
  routing: string;
  account: string;
  amountCents: bigint;
  name: string;
  txCode: "27" | "22" | "23" | "28";
  traceSeq: number;
};

const pad = (s: string, n: number) => s.slice(0, n).padEnd(n, " ");
const num = (v: bigint | number, n: number) => v.toString().padStart(n, "0").slice(-n);

export function buildNacha(args: {
  entries: Entry[];
  companyName: string;
  companyId: string;
  odfiRouting: string;
  effectiveDate: string;
  description: string;
}): string {
  const now = new Date();
  const fileDate = now.toISOString().slice(2, 10).replace(/-/g, "");
  const fileTime = now.toTimeString().slice(0, 5).replace(":", "");
  const L: string[] = [];

  L.push("101 " + num(BigInt(args.odfiRouting), 9) + num(BigInt(args.companyId.replace(/\D/g, "")), 10) +
    fileDate + fileTime + "A" + "094" + "10" + "1" +
    pad("FIRST CITIZENS", 23) + pad(args.companyName, 23) + pad("", 8));

  const sec = "CCD";
  L.push("5" + "225" +
    pad(args.companyName, 16) + pad("", 20) + pad(args.companyId, 10) +
    sec + pad(args.description, 10) + pad("", 6) + args.effectiveDate + pad("", 3) + "1" +
    num(BigInt(args.odfiRouting.slice(0, 8)), 8) + num(1n, 7));

  let hash = 0n, debits = 0n, credits = 0n;
  args.entries.forEach((e) => {
    hash += BigInt(e.routing.slice(0, 8));
    if (e.txCode === "27" || e.txCode === "28") debits += e.amountCents; else credits += e.amountCents;
    L.push("6" + e.txCode + num(BigInt(e.routing), 9) + pad(e.account, 17) +
      num(e.amountCents, 10) + pad("", 15) + pad(e.name, 22) + pad("", 2) + "0" +
      num(BigInt(args.odfiRouting.slice(0, 8)), 8) + num(BigInt(e.traceSeq), 7));
  });

  L.push("8" + "225" + num(BigInt(args.entries.length), 6) + num(hash % 10_000_000_000n, 10) +
    num(debits, 12) + num(credits, 12) + pad(args.companyId, 10) + pad("", 25) +
    num(BigInt(args.odfiRouting.slice(0, 8)), 8) + num(1n, 7));

  const blocks = Math.ceil((L.length + 1) / 10);
  L.push("9" + num(1n, 6) + num(BigInt(blocks), 6) + num(BigInt(args.entries.length), 8) +
    num(hash % 10_000_000_000n, 10) + num(debits, 12) + num(credits, 12) + pad("", 39));
  while (L.length % 10 !== 0) L.push("9".repeat(94));
  return L.map(l => pad(l, 94)).join("\n");
}
