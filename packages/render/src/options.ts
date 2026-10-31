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

export type TemplateId = "classic" | "modern" | "serif" | "precision" | "header" | "clear" | "balanced" | "twocolumn";

/** Visual theme of a template. */
export interface Theme {
  id: TemplateId;
  name: string;
  description: string;
  /** PDF standard font family */
  font: "Helvetica" | "Times-Roman";
  bold: "Helvetica-Bold" | "Times-Bold";
  /** matching Word font */
  docxFont: "Arial" | "Times New Roman";
  accent: string;
  nameColor?: string;
  heading: "rule" | "bar" | "plain";
  align: "left" | "center";
  /** contact details on the right of the name instead of below it */
  contactRight?: boolean;
  /** full-width coloured background behind the header */
  band?: { bg: string; fg: string };
  /** coloured side column holding contact, skills, languages, education */
  sidebar?: { side: "left" | "right"; bg: string; fg: string; accent: string; width: number };
  /** shows the profile photo when one is set */
  photo?: boolean;
  /** single column = safest for every ATS */
  singleColumn: boolean;
}

export const TEMPLATES: Record<TemplateId, Theme> = {
  classic: { id: "classic", name: "Simple ATS", description: "Navy headings with rules", font: "Helvetica", bold: "Helvetica-Bold", docxFont: "Arial", accent: "#1f3a5f", heading: "rule", align: "left", singleColumn: true },
  modern: { id: "modern", name: "Modern", description: "Teal accent bars", font: "Helvetica", bold: "Helvetica-Bold", docxFont: "Arial", accent: "#0f766e", heading: "bar", align: "left", singleColumn: true },
  serif: { id: "serif", name: "Corporate", description: "Centered, Times", font: "Times-Roman", bold: "Times-Bold", docxFont: "Times New Roman", accent: "#111111", heading: "rule", align: "center", singleColumn: true },
  precision: { id: "precision", name: "Precision", description: "Warm accent, contact on the right", font: "Times-Roman", bold: "Times-Bold", docxFont: "Times New Roman", accent: "#c2410c", nameColor: "#c2410c", heading: "plain", align: "left", contactRight: true, singleColumn: true },
  header: { id: "header", name: "Header", description: "Soft green header band", font: "Helvetica", bold: "Helvetica-Bold", docxFont: "Arial", accent: "#3f6212", heading: "plain", align: "left", contactRight: true, band: { bg: "#dbe7c9", fg: "#1a2e05" }, singleColumn: true },
  clear: { id: "clear", name: "Clear", description: "Mint header with photo, left sidebar", font: "Helvetica", bold: "Helvetica-Bold", docxFont: "Arial", accent: "#047857", heading: "plain", align: "left", band: { bg: "#6ee7b7", fg: "#052e16" }, sidebar: { side: "left", bg: "#f1f5f4", fg: "#1a1a1a", accent: "#047857", width: 170 }, photo: true, singleColumn: false },
  balanced: { id: "balanced", name: "Balanced", description: "Dark navy sidebar, photo", font: "Helvetica", bold: "Helvetica-Bold", docxFont: "Arial", accent: "#0b2545", heading: "rule", align: "left", sidebar: { side: "right", bg: "#0b2545", fg: "#ffffff", accent: "#9ec5ff", width: 175 }, photo: true, singleColumn: false },
  twocolumn: { id: "twocolumn", name: "Two column", description: "Light, details on the right", font: "Helvetica", bold: "Helvetica-Bold", docxFont: "Arial", accent: "#b45309", nameColor: "#b45309", heading: "plain", align: "left", sidebar: { side: "right", bg: "#ffffff", fg: "#1a1a1a", accent: "#b45309", width: 165 }, singleColumn: false },
};

export interface DocStyle {
  template?: TemplateId;
  /** document language code, see DOC_LANGUAGES in @cvtuner/core */
  lang?: string;
  /** bold numbers and percentages in bullets (default on) */
  boldMetrics?: boolean;
}
