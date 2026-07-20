// ————— STATEMENT OF ACCOUNT PDF: the same running-balance math the court packet uses —————
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

const INK = "#181818", MUTE = "#514C41", FAINT = "#7A7365", TEAL = "#0D9488", LINE = "#E7DFCE", RED = "#D62839";

export type StatementRow = { date: string; ref: string; description: string; chargeCents: bigint | null; creditCents: bigint | null };
export type StatementData = {
  client: { name: string; dba: string | null };
  asOf: string;
  rows: StatementRow[];
  entity: { name: string; address: string; email: string };
  forCourt?: boolean;
};

const usd = (c: bigint) => {
  const neg = c < 0n; const a = neg ? -c : c;
  return `${neg ? "-" : ""}$${(a / 100n).toLocaleString()}.${(a % 100n).toString().padStart(2, "0")}`;
};

export function renderStatementPdf(d: StatementData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margins: { top: 54, bottom: 60, left: 54, right: 54 } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const W = doc.page.width, L = 54, R = W - 54, CW = R - L;

    const logoPath = path.join(process.cwd(), "public", "logo.png");
    if (fs.existsSync(logoPath)) doc.image(logoPath, L, 50, { height: 30 });
    else doc.font("Helvetica-Bold").fontSize(17).fillColor(INK).text("SESHSURE", L, 52, { continued: true }).fillColor(TEAL).text(" HUB");
    doc.font("Helvetica").fontSize(7.5).fillColor(MUTE)
      .text(d.entity.name, L, 52, { width: CW, align: "right" })
      .text(d.entity.address, { width: CW, align: "right" });

    let y = 100;
    doc.font("Helvetica-Bold").fontSize(13).fillColor(INK).text("STATEMENT OF ACCOUNT", L, y);
    y += 18;
    doc.font("Courier").fontSize(7.5).fillColor(MUTE)
      .text(`ACCOUNT: ${(d.client.dba ?? d.client.name).toUpperCase()}${d.client.dba ? ` (${d.client.name.toUpperCase()})` : ""}   ·   AS OF ${d.asOf}`, L, y);
    if (d.forCourt) {
      y += 12;
      doc.font("Courier").fontSize(6.5).fillColor(FAINT)
        .text("PREPARED FROM BUSINESS RECORDS KEPT IN THE ORDINARY COURSE. PAYMENTS SHOWN ONLY WHEN FUNDS ACTUALLY AND FINALLY COLLECTED.", L, y, { width: CW });
    }
    y += 20;

    const cols = { date: L, ref: L + 66, desc: L + 138, charge: R - 210, credit: R - 140, bal: R - 70 };
    const head = () => {
      doc.moveTo(L, y).lineTo(R, y).lineWidth(1).strokeColor(INK).stroke(); y += 6;
      doc.font("Courier-Bold").fontSize(6.2).fillColor(FAINT);
      doc.text("DATE", cols.date, y).text("REF", cols.ref, y).text("DESCRIPTION", cols.desc, y);
      doc.text("CHARGE", cols.charge, y, { width: 64, align: "right" });
      doc.text("PAYMENT", cols.credit, y, { width: 64, align: "right" });
      doc.text("BALANCE", cols.bal, y, { width: 70, align: "right" });
      y += 11; doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor(LINE).stroke(); y += 5;
    };
    head();

    let bal = 0n;
    for (const r of d.rows) {
      if (y > doc.page.height - 90) { doc.addPage(); y = 60; head(); }
      bal += (r.chargeCents ?? 0n) - (r.creditCents ?? 0n);
      doc.font("Courier").fontSize(7).fillColor(MUTE).text(r.date.slice(0, 10), cols.date, y);
      doc.text(r.ref, cols.ref, y, { width: 66 });
      doc.font("Helvetica").fontSize(7.5).fillColor(INK).text(r.description, cols.desc, y, { width: cols.charge - cols.desc - 8 });
      doc.font("Courier").fontSize(7.5).fillColor(INK);
      if (r.chargeCents !== null) doc.text(usd(r.chargeCents), cols.charge, y, { width: 64, align: "right" });
      if (r.creditCents !== null) doc.fillColor(TEAL).text(usd(r.creditCents), cols.credit, y, { width: 64, align: "right" });
      doc.fillColor(bal > 0n ? INK : TEAL).font("Courier-Bold").text(usd(bal), cols.bal, y, { width: 70, align: "right" });
      y += 15;
      doc.moveTo(L, y - 4).lineTo(R, y - 4).lineWidth(0.4).strokeColor(LINE).stroke();
    }

    y += 8;
    doc.roundedRect(R - 210, y, 210, 30, 5).lineWidth(0.75).strokeColor(bal > 0n ? RED : LINE).stroke();
    doc.font("Courier-Bold").fontSize(7).fillColor(FAINT).text("TOTAL BALANCE DUE", R - 198, y + 7);
    doc.font("Courier-Bold").fontSize(13).fillColor(bal > 0n ? RED : TEAL).text(usd(bal), R - 198, y + 15, { width: 186, align: "right" });

    doc.font("Helvetica").fontSize(6.5).fillColor(FAINT)
      .text(`${d.entity.name} · ${d.entity.address} · ${d.entity.email}`, L, doc.page.height - 46, { width: CW, align: "center" });
    doc.end();
  });
}
