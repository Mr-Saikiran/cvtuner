import { docLabels, localizeDate, type Resume } from "@cvtuner/core";
import { AlignmentType, BorderStyle, Document, ExternalHyperlink, LevelFormat, Packer, Paragraph, TabStopType, TextRun } from "docx";
import { PAGE, TEMPLATES, type DocStyle, type LayoutOptions } from "./options";

const pt = (n: number) => Math.round(n * 2); // docx sizes are half-points
const twip = (n: number) => Math.round(n * 20); // twentieths of a point

/**
 * Builds a .docx with the same content, fonts and margins as the PDF.
 * Single column, real text, no tables or text boxes — safe for ATS parsers.
 */
export function buildDocx(resume: Resume, layout: LayoutOptions, style: DocStyle = {}): Document {
  const theme = TEMPLATES[style.template ?? "classic"];
  const ACCENT = theme.accent.replace("#", "").toUpperCase();
  const L = docLabels(style.lang);
  const align = theme.align === "center" ? AlignmentType.CENTER : AlignmentType.LEFT;
  const size = pt(layout.fontSize);
  const line = Math.round(240 * layout.lineHeight);
  const contentWidth = twip(PAGE.width - layout.margin * 2);
  const b = resume.basics;
  const children: Paragraph[] = [];

  const heading = (text: string) =>
    new Paragraph({
      spacing: { before: twip(layout.gap * 1.4), after: twip(layout.gap * 0.6) },
      alignment: align,
      border:
        theme.heading === "bar"
          ? { left: { style: BorderStyle.SINGLE, size: 18, color: ACCENT, space: 4 } }
          : { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 1 } },
      children: [new TextRun({ text: text.toUpperCase(), bold: true, color: ACCENT, size: pt(layout.fontSize * 1.05), characterSpacing: 12 })],
    });
  const bullet = (text: string) =>
    new Paragraph({ numbering: { reference: "dots", level: 0 }, spacing: { line, after: 20 }, children: [new TextRun({ text, size })] });
  const rowWithDate = (left: TextRun[], right?: string) =>
    new Paragraph({
      spacing: { line, before: twip(layout.gap * 0.4) },
      keepNext: true,
      tabStops: [{ type: TabStopType.RIGHT, position: contentWidth }],
      children: [...left, ...(right ? [new TextRun({ text: `\t${right}`, size, color: "555555" })] : [])],
    });
  const dates = (a?: string, c?: string) => [localizeDate(a, L), localizeDate(c, L)].filter(Boolean).join(" – ");

  children.push(
    new Paragraph({ alignment: align, children: [new TextRun({ text: b.name, bold: true, color: ACCENT, size: pt(layout.fontSize * 2) })] }),
  );
  if (b.label) children.push(new Paragraph({ alignment: align, children: [new TextRun({ text: b.label, size: pt(layout.fontSize * 1.1), color: "333333" })] }));
  const contact = [b.email, b.phone, b.location].filter(Boolean) as string[];
  if (contact.length || b.url) {
    const runs: (TextRun | ExternalHyperlink)[] = [new TextRun({ text: contact.join("  |  "), size: pt(layout.fontSize * 0.92), color: "444444" })];
    if (b.url) {
      runs.push(new TextRun({ text: contact.length ? "  |  " : "", size: pt(layout.fontSize * 0.92), color: "444444" }));
      runs.push(new ExternalHyperlink({ link: b.url.startsWith("http") ? b.url : `https://${b.url}`, children: [new TextRun({ text: b.url, size: pt(layout.fontSize * 0.92), style: "Hyperlink" })] }));
    }
    children.push(new Paragraph({ alignment: align, spacing: { before: 60 }, children: runs }));
  }

  if (b.summary) {
    children.push(heading(L.summary), new Paragraph({ spacing: { line }, children: [new TextRun({ text: b.summary, size })] }));
  }
  const groups = resume.skills.filter((g) => g.keywords.length);
  if (groups.length) {
    children.push(heading(L.skills));
    for (const g of groups) {
      children.push(
        new Paragraph({
          spacing: { line },
          children: [
            ...(groups.length > 1 ? [new TextRun({ text: `${g.name}: `, bold: true, size })] : []),
            new TextRun({ text: g.keywords.join(" · "), size }),
          ],
        }),
      );
    }
  }
  if (resume.work.length) {
    children.push(heading(L.experience));
    for (const w of resume.work) {
      children.push(
        rowWithDate(
          [
            new TextRun({ text: w.position, bold: true, size }),
            new TextRun({ text: `${w.position && w.name ? ", " : ""}${w.name}`, size }),
            ...(w.location ? [new TextRun({ text: `, ${w.location}`, size, color: "555555" })] : []),
          ],
          dates(w.startDate, w.endDate),
        ),
      );
      if (w.summary) children.push(new Paragraph({ spacing: { line }, children: [new TextRun({ text: w.summary, size })] }));
      w.highlights.forEach((h) => children.push(bullet(h)));
    }
  }
  if (resume.projects.length) {
    children.push(heading(L.projects));
    for (const p of resume.projects) {
      children.push(rowWithDate([new TextRun({ text: p.name, bold: true, size })]));
      if (p.description) children.push(new Paragraph({ spacing: { line }, children: [new TextRun({ text: p.description, size })] }));
      p.highlights.forEach((h) => children.push(bullet(h)));
    }
  }
  if (resume.education.length) {
    children.push(heading(L.education));
    for (const e of resume.education) {
      const degree = [e.studyType, e.area].filter(Boolean).join(", ");
      children.push(
        rowWithDate(
          [
            new TextRun({ text: degree || e.institution, bold: true, size }),
            ...(degree ? [new TextRun({ text: `, ${e.institution}`, size })] : []),
            ...(e.score ? [new TextRun({ text: ` (${e.score})`, size, color: "555555" })] : []),
          ],
          dates(e.startDate, e.endDate),
        ),
      );
    }
  }
  if (resume.certificates.length) {
    children.push(heading(L.certifications));
    resume.certificates.forEach((c) => children.push(bullet(c)));
  }

  return new Document({
    creator: "CVTuner",
    title: b.name || "Resume",
    styles: { default: { document: { run: { font: theme.docxFont, size } } } },
    numbering: {
      config: [
        {
          reference: "dots",
          levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 260, hanging: 200 } } } }],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: twip(PAGE.width), height: twip(PAGE.height) },
            margin: { top: twip(layout.margin), bottom: twip(layout.margin), left: twip(layout.margin), right: twip(layout.margin) },
          },
        },
        children,
      },
    ],
  });
}

export async function renderDocx(resume: Resume, layout: LayoutOptions, style?: DocStyle): Promise<Blob> {
  return Packer.toBlob(buildDocx(resume, layout, style));
}
