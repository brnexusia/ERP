/**
 * Small, dependency-free PDF writer for read-only packing slips.
 * Produces A4 multi-page PDF 1.4 with built-in Helvetica (WinAnsi/Latin1).
 * No prices, credit balances, or private product costs are printed.
 */
export type PackingSlipData = {
  organization: string;
  saleId: string;
  orderedAt: Date | null;
  createdAt: Date;
  client: string;
  seller: string;
  address: string;
  status: "NOT_SEPARATED" | "SEPARATED" | "VERIFIED";
  separatedBy?: string | null;
  verifiedBy?: string | null;
  items: Array<{ sku: string; description: string; quantity: string }>;
};

const W = 595;
const H = 842;
const MARGIN = 44;

function winAnsi(input: string): string {
  // PDF Helvetica WinAnsi supports common Portuguese Latin-1 glyphs.
  return input.normalize("NFC")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/[^\u0020-\u007e\u00a1-\u00ff]/g, "?");
}

function pdfString(input: string) {
  return winAnsi(input)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function text(x: number, y: number, label: string, size = 9): string {
  return "BT /F1 " + size + " Tf 1 0 0 1 " + x + " " + y +
    " Tm (" + pdfString(label) + ") Tj ET\n";
}

function line(x1: number, y1: number, x2: number, y2: number) {
  return "0.79 G 0.6 w " + x1 + " " + y1 + " m " + x2 + " " + y2 + " l S\n0 G\n";
}

function wrap(input: string, width: number): string[] {
  const result: string[] = [];
  const words = winAnsi(input).replace(/\s+/g, " ").trim().split(" ");
  let current = "";
  for (const word of words) {
    if (!word) continue;
    let pending = word;
    while (pending.length > width) {
      if (current) { result.push(current); current = ""; }
      result.push(pending.slice(0, width));
      pending = pending.slice(width);
    }
    if (!pending) continue;
    if (!current) current = pending;
    else if (current.length + 1 + pending.length <= width) current += " " + pending;
    else { result.push(current); current = pending; }
  }
  if (current) result.push(current);
  return result.length ? result : ["-"];
}

function statusLabel(status: PackingSlipData["status"]) {
  if (status === "VERIFIED") return "CONFERIDO";
  if (status === "SEPARATED") return "SEPARADO - AGUARDANDO CONFERENCIA";
  return "AGUARDANDO SEPARACAO";
}

function stamp(date: Date | null) {
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short",
      }).format(date)
    : "-";
}

export function buildPackingSlipPdf(data: PackingSlipData, generatedAt = new Date()): Buffer {
  const pages: string[] = [];
  let commands = "";
  let y = 0;

  const print = (value: string, size = 9, x = MARGIN) => {
    commands += text(x, y, value, size);
    y -= size + 6;
  };
  const newPage = () => {
    if (commands) pages.push(commands);
    commands = "";
    y = H - MARGIN;
    commands += "0 G 0 g\n";
    print("ROMANEIO DE SEPARACAO", 17);
    print(data.organization, 10);
    commands += line(MARGIN, y + 5, W - MARGIN, y + 5);
    y -= 13;
    print("PEDIDO: " + data.saleId);
    print("Emitido em: " + stamp(generatedAt) + "    Pedido confirmado em: " + stamp(data.orderedAt));
    for (const part of wrap("Cliente: " + data.client, 86)) print(part);
    for (const part of wrap("Vendedora: " + data.seller, 86)) print(part);
    for (const part of wrap("Destino: " + data.address, 86)) print(part);
    print("Situacao: " + statusLabel(data.status));
    if (data.separatedBy) for (const part of wrap("Separado por: " + data.separatedBy, 86)) print(part);
    if (data.verifiedBy) for (const part of wrap("Conferido por: " + data.verifiedBy, 86)) print(part);
    y -= 9;
    commands += "0.92 g " + MARGIN + " " + (y - 7) + " " + (W - 2 * MARGIN) + " 23 re f\n0 g\n";
    commands += text(51, y, "#", 9);
    commands += text(80, y, "SKU", 9);
    commands += text(215, y, "PRODUTO", 9);
    commands += text(510, y, "QTD.", 9);
    y -= 25;
  };

  newPage();
  data.items.forEach((item, index) => {
    const skuLines = wrap(item.sku, 23);
    const descriptionLines = wrap(item.description, 50);
    const lines = Math.max(skuLines.length, descriptionLines.length);
    const requiredHeight = Math.max(1, lines) * 12 + 13;
    if (y - requiredHeight < 94) newPage();
    commands += text(50, y, String(index + 1), 9);
    commands += text(510, y, item.quantity, 9);
    for (let part = 0; part < lines; part++) {
      if (skuLines[part]) commands += text(80, y - part * 12, skuLines[part], 9);
      if (descriptionLines[part]) commands += text(215, y - part * 12, descriptionLines[part], 9);
    }
    y -= requiredHeight;
    commands += line(MARGIN, y + 5, W - MARGIN, y + 5);
  });
  if (y > 185) {
    y -= 20;
    print("Separacao: __________________________________________");
    print("Conferencia: _________________________________________");
  }
  pages.push(commands);

  const pageCount = pages.length;
  const fontId = 3;
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [" +
      pages.map((_, index) => (4 + index * 2) + " 0 R").join(" ") +
      "] /Count " + pageCount + " >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  for (let index = 0; index < pageCount; index++) {
    const pageObjectId = 4 + index * 2;
    const contentId = pageObjectId + 1;
    let stream = pages[index];
    stream += line(MARGIN, 59, W - MARGIN, 59);
    stream += text(MARGIN, 43, "Documento operacional - nao e documento fiscal.", 8);
    stream += text(480, 43, "Pagina " + (index + 1) + "/" + pageCount, 8);
    objects.push(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + W + " " + H +
      "] /Resources << /Font << /F1 " + fontId + " 0 R >> >> /Contents " +
      contentId + " 0 R >>",
    );
    objects.push(
      "<< /Length " + Buffer.byteLength(stream, "latin1") + " >>\nstream\n" +
      stream + "endstream",
    );
  }

  let output = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(output, "latin1"));
    output += (index + 1) + " 0 obj\n" + body + "\nendobj\n";
  });
  const xrefOffset = Buffer.byteLength(output, "latin1");
  output += "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    output += String(offset).padStart(10, "0") + " 00000 n \n";
  }
  output += "trailer\n<< /Size " + (objects.length + 1) +
    " /Root 1 0 R >>\nstartxref\n" + xrefOffset + "\n%%EOF\n";
  return Buffer.from(output, "latin1");
}
