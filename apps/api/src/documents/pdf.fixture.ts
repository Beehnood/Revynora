// Synthetic PDFs used only by document tests; no production analysis fixture.
export function textPdf(
  text:
    | string
    | string[] = "Les cellules utilisent de l energie. La membrane protege la cellule et regule les echanges.",
  count = 1,
  active = false,
) {
  const objects: string[] = [];
  const add = (v: string) => {
    objects.push(v);
    return objects.length;
  };
  add(
    `<< /Type /Catalog /Pages 2 0 R ${active ? "/OpenAction << /S /JavaScript /JS (app.alert\\(1\\)) >>" : ""} >>`,
  );
  add(
    `<< /Type /Pages /Kids [${Array.from({ length: count }, (_, i) => `${4 + i * 2} 0 R`).join(" ")}] /Count ${count} >>`,
  );
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  for (let i = 0; i < count; i++) {
    const pageText = Array.isArray(text) ? text[i % text.length] : text;
    const stream = `BT /F1 ${pageText.length > 500 ? 0.01 : 12} Tf 30 700 Td (${pageText.replace(/[\\()]/g, "\\$&")}) Tj ET`;
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`,
    );
    add(
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    );
  }
  let value = "%PDF-1.7\n";
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(value));
    value += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(value);
  value +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
      .join("");
  return Buffer.from(
    value +
      `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
  );
}
