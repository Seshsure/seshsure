// Smoke test: render sample invoice + statement PDFs with realistic data
import { createRequire } from "module";
const require = createRequire("/home/claude/seshsure/hub/package.json");
process.chdir("/home/claude/seshsure/hub");
const ts = require("typescript");
const fs = require("fs");

function loadTs(p) {
  const src = fs.readFileSync(p, "utf8");
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", "process", js)(require, mod, mod.exports, process);
  return mod.exports;
}
const { renderInvoicePdf } = loadTs("src/lib/pdf/invoice-pdf.ts");
const { renderStatementPdf } = loadTs("src/lib/pdf/statement-pdf.ts");

const entity = {
  name: "Vido Manufacturing and Distribution Corp d/b/a SeshSure",
  address: "10940 S. Parker Rd, Suite 788, Parker, CO 80134",
  email: "billing@seshsure.com",
  checksPayableTo: "Vido Manufacturing and Distribution Corp",
  remitAddress: "10940 S. Parker Rd, Suite 788, Parker, CO 80134",
};

const inv = await renderInvoicePdf({
  invoiceNumber: "SS-1041", kind: "balance", status: "overdue",
  issuedOn: "2026-06-26", dueOn: "2026-07-10", poNumber: "KO-118", orderNumber: "SS-O-1027",
  billTo: { name: "KO Distribution LLC", dba: "KO Distro", address: "4410 Brighton Blvd, Denver, CO 80216" },
  lines: [
    { description: "98mm commodity cone, white — 500,000 units @ 3.06¢/cone (balance)", amountCents: 7650_00n },
    { description: "109mm commodity cone, unbleached — 150,000 units @ 3.40¢/cone (balance)", amountCents: 2550_00n },
    { description: "Freight — Denver delivery", amountCents: 1938_00n },
  ],
  subtotalCents: 12138_00n, interestCents: 182_00n, totalCents: 12320_00n, paidCents: 0n,
  entity, portalUrl: "https://hub.seshsure.com/portal/invoices/…",
});
fs.writeFileSync("/mnt/user-data/outputs/SAMPLE-INVOICE.pdf", inv);

const stmt = await renderStatementPdf({
  client: { name: "KO Distribution LLC", dba: "KO Distro" },
  asOf: "2026-07-16", forCourt: true,
  rows: [
    { date: "2026-03-04", ref: "SS-1012", description: "Invoice (deposit)", chargeCents: 7650_00n, creditCents: null },
    { date: "2026-03-06", ref: "a1b2c3d4", description: "Payment (ach) — cleared", chargeCents: null, creditCents: 7650_00n },
    { date: "2026-04-11", ref: "SS-1019", description: "Invoice (balance)", chargeCents: 7650_00n, creditCents: null },
    { date: "2026-04-30", ref: "e5f6a7b8", description: "Payment (wire) — cleared", chargeCents: null, creditCents: 7650_00n },
    { date: "2026-06-26", ref: "SS-1041", description: "Invoice (balance)", chargeCents: 12320_00n, creditCents: null },
  ],
  entity,
});
fs.writeFileSync("/mnt/user-data/outputs/SAMPLE-STATEMENT.pdf", stmt);
console.log("invoice:", inv.length, "bytes · statement:", stmt.length, "bytes");
