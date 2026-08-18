import fs from "node:fs";
import { pathToFileURL } from "node:url";
const pdfjs = await import(pathToFileURL("node_modules/pdfjs-dist/legacy/build/pdf.mjs").href);

const FILE = "C:\\Users\\Antônio\\Downloads\\Peru\\Passagem aérea\\Vouchers para voos Gru Cusco.pdf";
const data = new Uint8Array(fs.readFileSync(FILE));
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
console.log("Páginas:", doc.numPages);
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const tc = await page.getTextContent();
  const txt = tc.items.map((it) => it.str).join(" ").replace(/\s+/g, " ").trim();
  console.log(`\n===== PÁGINA ${i} =====`);
  console.log(txt.slice(0, 600));
}
