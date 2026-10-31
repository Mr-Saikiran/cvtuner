/** Layout knobs shared by the PDF and DOCX renderers so both produce the same length. */
export interface LayoutOptions {
  /** body font size in pt */
  fontSize: number;
  /** extra space between blocks in pt */
  gap: number;
  /** page margin in pt */
  margin: number;
  lineHeight: number;
}

/** Density levels tried in order before any content is dropped. */
export const DENSITY: LayoutOptions[] = [
  { fontSize: 10.5, gap: 8, margin: 42, lineHeight: 1.3 },
  { fontSize: 10.25, gap: 6, margin: 38, lineHeight: 1.25 },
  { fontSize: 10, gap: 5, margin: 34, lineHeight: 1.2 },
];

export const PAGE = { width: 595.28, height: 841.89 }; // A4 in pt

export type TemplateId = "classic" | "modern" | "serif";

/** Visual theme of a template. All templates are single column and ATS-safe. */
export interface Theme {
  id: TemplateId;
  name: string;
  /** PDF standard font family */
  font: "Helvetica" | "Times-Roman";
  bold: "Helvetica-Bold" | "Times-Bold";
  /** matching Word font */
  docxFont: "Arial" | "Times New Roman";
  accent: string;
  heading: "rule" | "bar" | "plain";
  align: "left" | "center";
}

export const TEMPLATES: Record<TemplateId, Theme> = {
  classic: { id: "classic", name: "Classic", font: "Helvetica", bold: "Helvetica-Bold", docxFont: "Arial", accent: "#1f3a5f", heading: "rule", align: "left" },
  modern: { id: "modern", name: "Modern", font: "Helvetica", bold: "Helvetica-Bold", docxFont: "Arial", accent: "#0f766e", heading: "bar", align: "left" },
  serif: { id: "serif", name: "Serif", font: "Times-Roman", bold: "Times-Bold", docxFont: "Times New Roman", accent: "#111111", heading: "rule", align: "center" },
};

export interface DocStyle {
  template?: TemplateId;
  /** document language code, see DOC_LANGUAGES in @cvtuner/core */
  lang?: string;
}
