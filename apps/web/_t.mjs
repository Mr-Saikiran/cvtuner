import { getDocumentProxy } from "unpdf";
import { readFileSync } from "node:fs";
import { layoutPdfText } from "../../packages/core/src/pdfLayout.ts";
const doc = await getDocumentProxy(new Uint8Array(readFileSync(process.argv[2])));
const pages = [];
for (let n = 1; n <= doc.numPages; n++) {
  const page = await doc.getPage(n);
  const { width } = page.getViewport({ scale: 1 });
  const c = await page.getTextContent();
  pages.push({ width, items: c.items.filter(i => "str" in i).map(i => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: i.height || Math.abs(i.transform[3]) })) });
}
console.log(layoutPdfText(pages));
