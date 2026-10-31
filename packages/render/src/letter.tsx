import type { CoverLetter, Resume } from "@cvtuner/core";
import { Document as PdfDocument, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { AlignmentType, Document, Packer, Paragraph, TextRun } from "docx";
import { PAGE, TEMPLATES, type DocStyle } from "./options";

/** Cover letter in the same template family as the resume, one page. */
function LetterDocument({ letter, resume, style = {} }: { letter: CoverLetter; resume: Resume; style?: DocStyle }) {
  const t = TEMPLATES[style.template ?? "classic"];
  const s = StyleSheet.create({
    page: { padding: 56, fontFamily: t.font, fontSize: 11, lineHeight: 1.45, color: "#1a1a1a" },
    name: { fontFamily: t.bold, fontSize: 18, color: t.accent, textAlign: t.align },
    contact: { fontSize: 9.5, color: "#444", marginTop: 2, marginBottom: 24, textAlign: t.align },
    p: { marginBottom: 10 },
  });
  const b = resume.basics;
  return (
    <PdfDocument title={`Cover letter - ${b.name}`} author={b.name} creator="CVTuner">
      <Page size="A4" style={s.page}>
        <Text style={s.name}>{b.name}</Text>
        <Text style={s.contact}>{[b.email, b.phone, b.location].filter(Boolean).join("  |  ")}</Text>
        <Text style={s.p}>{letter.date}</Text>
        <Text style={s.p}>{letter.recipient}</Text>
        <Text style={s.p}>{letter.greeting}</Text>
        {letter.paragraphs.map((p, i) => (
          <Text key={i} style={s.p}>
            {p}
          </Text>
        ))}
        <View style={{ marginTop: 8 }}>
          <Text>{letter.closing}</Text>
          <Text style={{ fontFamily: t.bold, marginTop: 18 }}>{letter.signature}</Text>
        </View>
      </Page>
    </PdfDocument>
  );
}

export async function renderLetterPdf(letter: CoverLetter, resume: Resume, style?: DocStyle): Promise<Uint8Array> {
  const blob = await pdf(<LetterDocument letter={letter} resume={resume} style={style} />).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}

export function buildLetterDocx(letter: CoverLetter, resume: Resume, style: DocStyle = {}): Document {
  const t = TEMPLATES[style.template ?? "classic"];
  const align = t.align === "center" ? AlignmentType.CENTER : AlignmentType.LEFT;
  const b = resume.basics;
  const para = (text: string, opts: { bold?: boolean; after?: number } = {}) =>
    new Paragraph({ spacing: { after: opts.after ?? 200, line: 300 }, children: [new TextRun({ text, bold: opts.bold, size: 22 })] });
  return new Document({
    creator: "CVTuner",
    title: `Cover letter - ${b.name}`,
    styles: { default: { document: { run: { font: t.docxFont, size: 22 } } } },
    sections: [
      {
        properties: { page: { size: { width: Math.round(PAGE.width * 20), height: Math.round(PAGE.height * 20) }, margin: { top: 1120, bottom: 1120, left: 1120, right: 1120 } } },
        children: [
          new Paragraph({ alignment: align, children: [new TextRun({ text: b.name, bold: true, size: 36, color: t.accent.replace("#", "") })] }),
          new Paragraph({ alignment: align, spacing: { after: 400 }, children: [new TextRun({ text: [b.email, b.phone, b.location].filter(Boolean).join("  |  "), size: 19, color: "444444" })] }),
          para(letter.date),
          para(letter.recipient),
          para(letter.greeting),
          ...letter.paragraphs.map((p) => para(p)),
          para(letter.closing, { after: 400 }),
          para(letter.signature, { bold: true }),
        ],
      },
    ],
  });
}

export async function renderLetterDocx(letter: CoverLetter, resume: Resume, style?: DocStyle): Promise<Blob> {
  return Packer.toBlob(buildLetterDocx(letter, resume, style));
}
