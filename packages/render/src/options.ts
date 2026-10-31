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
