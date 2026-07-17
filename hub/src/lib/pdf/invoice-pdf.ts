// ————— INVOICE PDF: pure layout function — data in, PDF bytes out —————
// Brand slot reserved: drop logo at hub/public/logo.png and it embeds automatically;
// until then the typographic wordmark carries the header.
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

const INK = "#15181A", MUTE = "#6E756B", FAINT = "#9B9F98", TEAL = "#0D9488", LINE = "#E4E1DA", RED = "#B4231F";

export type InvoiceData = {
  invoiceNumber: string;
  kind: string;
  status: string;
  issuedOn: string;
  dueOn: string | null;
  poNumber: string | null;
  orderNumber: string | null;
  billTo: { name: string; dba: string | null; address: string | null };
  lines: { description: string; amountCents: bigint }[];
  subtotalCents: bigint;
  interestCents: bigint;
  totalCents: bigint;
  paidCents: bigint;
  entity: { name: string; address: string; email: string; checksPayableTo: string; remitAddress: string };
  portalUrl: string;
};

const usd = (c: bigint) => {
  const neg = c < 0n; const a = neg ? -c : c;
  return `${neg ? "-" : ""}$${(a / 100n).toLocaleString()}.${(a % 100n).toString().padStart(2, "0")}`;
};

export function renderInvoicePdf(d: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margins: { top: 54, bottom: 54, left: 54, right: 54 } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width, L = 54, R = W - 54, CW = R - L;

    // ——— header: logo slot or wordmark ———
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, L, 50, { height: 34 });
    } else {
      doc.font("Helvetica-Bold").fontSize(19).fillColor(INK).text("SESHSURE", L, 52, { continued: true })
        .fillColor(TEAL).text(" HUB");
      doc.font("Courier").fontSize(6.5).fillColor(FAINT).text("PUFF · PEEL · PASS ™", L, 74, { characterSpacing: 1.5 });
    }
    doc.font("Helvetica").fontSize(7.5).fillColor(MUTE)
      .text(d.entity.name, L, 52, { width: CW, align: "right" })
      .text(d.entity.address, { width: CW, align: "right" })
      .text(d.entity.email, { width: CW, align: "right" });

    // ——— title band ———
    let y = 108;
    doc.font("Helvetica-Bold").fontSize(15).fillColor(INK).text(`INVOICE ${d.invoiceNumber}`, L, y);
    const paidInFull = d.paidCents >= d.totalCents && d.totalCents > 0n;
    const overdue = !paidInFull && d.dueOn !== null && d.dueOn < new Date().toISOString().slice(0, 10);
    const badge = paidInFull ? "PAID" : overdue ? "PAST DUE" : d.kind.toUpperCase();
    const bc = paidInFull ? TEAL : overdue ? RED : MUTE;
    const bw = doc.font("Helvetica-Bold").fontSize(8).widthOfString(badge) + 14;
    doc.roundedRect(R - bw, y + 1, bw, 15, 3).fillOpacity(0.1).fill(bc).fillOpacity(1);
    doc.fillColor(bc).text(badge, R - bw, y + 5, { width: bw, align: "center" });

    y += 26;
    doc.font("Courier").fontSize(7.5).fillColor(MUTE);
    const meta: string[] = [`ISSUED ${d.issuedOn}`];
    if (d.dueOn) meta.push(`DUE ${d.dueOn}`);
    if (d.poNumber) meta.push(`YOUR PO ${d.poNumber}`);
    if (d.orderNumber) meta.push(`ORDER ${d.orderNumber}`);
    doc.text(meta.join("   ·   "), L, y);

    // ——— bill to ———
    y += 24;
    doc.font("Courier-Bold").fontSize(6.5).fillColor(FAINT).text("BILL TO", L, y);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text(d.billTo.dba ?? d.billTo.name, L, y + 10);
    let by = y + 24;
    if (d.billTo.dba) { doc.font("Helvetica").fontSize(8).fillColor(MUTE).text(d.billTo.name, L, by); by += 11; }
    if (d.billTo.address) { doc.font("Helvetica").fontSize(8).fillColor(MUTE).text(d.billTo.address, L, by, { width: 260 }); by += 22; }

    // ——— line items ———
    y = Math.max(by + 14, y + 52);
    doc.moveTo(L, y).lineTo(R, y).lineWidth(1).strokeColor(INK).stroke();
    y += 7;
    doc.font("Courier-Bold").fontSize(6.5).fillColor(FAINT)
      .text("DESCRIPTION", L, y).text("AMOUNT", R - 100, y, { width: 100, align: "right" });
    y += 12;
    doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor(LINE).stroke();
    y += 8;
    for (const line of d.lines) {
      const h = doc.font("Helvetica").fontSize(9).heightOfString(line.description, { width: CW - 120 });
      doc.fillColor(INK).text(line.description, L, y, { width: CW - 120 });
      doc.font("Courier").fontSize(9).fillColor(INK).text(usd(line.amountCents), R - 110, y, { width: 110, align: "right" });
      y += Math.max(h, 12) + 6;
      doc.moveTo(L, y - 3).lineTo(R, y - 3).lineWidth(0.5).strokeColor(LINE).stroke();
    }

    // ——— totals ———
    y += 6;
    const trow = (label: string, val: string, opts?: { bold?: boolean; color?: string; size?: number }) => {
      doc.font(opts?.bold ? "Courier-Bold" : "Courier").fontSize(opts?.size ?? 8.5).fillColor(opts?.color ?? MUTE)
        .text(label, R - 250, y, { width: 140, align: "right" })
        .text(val, R - 110, y, { width: 110, align: "right" });
      y += (opts?.size ?? 8.5) + 6;
    };
    trow("SUBTOTAL", usd(d.subtotalCents));
    if (d.interestCents > 0n) trow("INTEREST (1.5%/MO PAST DUE)", usd(d.interestCents), { color: RED });
    trow("TOTAL", usd(d.totalCents), { bold: true, color: INK, size: 11 });
    if (d.paidCents > 0n) {
      trow("PAID", `-${usd(d.paidCents).slice(1)}`, { color: TEAL });
      trow("BALANCE DUE", usd(d.totalCents - d.paidCents), { bold: true, color: paidInFull ? TEAL : INK, size: 12 });
    }

    // ——— payment box ———
    y += 12;
    doc.roundedRect(L, y, CW, 74, 6).lineWidth(0.75).strokeColor(LINE).stroke();
    doc.font("Courier-Bold").fontSize(6.5).fillColor(FAINT).text("HOW TO PAY", L + 12, y + 10);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(INK).text("Fastest — pay online (ACH, no fees):", L + 12, y + 22);
    doc.font("Courier").fontSize(8).fillColor(TEAL).text(d.portalUrl, L + 12, y + 34);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(INK).text("By check:", L + 260, y + 22);
    doc.font("Helvetica").fontSize(7.5).fillColor(MUTE)
      .text(`Payable to ${d.entity.checksPayableTo}`, L + 260, y + 34, { width: CW - 272 })
      .text(d.entity.remitAddress, { width: CW - 272 });
    doc.font("Helvetica").fontSize(6.5).fillColor(FAINT)
      .text("An obligation is satisfied when funds are actually and finally collected. Past-due balances accrue 1.5% per month per agreement.", L + 12, y + 58, { width: CW - 24 });

    // ——— footer ———
    doc.font("Helvetica").fontSize(6.5).fillColor(FAINT)
      .text(`${d.entity.name} · ${d.entity.address} · ${d.entity.email}`, L, doc.page.height - 46, { width: CW, align: "center" });
    doc.end();
  });
}
