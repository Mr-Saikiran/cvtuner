import type { Resume } from "./schema";
import { stem, tokens } from "./text";

export interface TextRun {
  text: string;
  bold?: boolean;
}

/**
 * Numbers that make achievements scannable: 9%, 120+, ₹40 Cr, $1.2M, 3x, 6 days.
 * Years on their own (2021) are left alone.
 */
const METRIC =
  /(?:[₹$€£]\s?|\b(?:INR|USD|EUR|Rs\.?)\s?)?\b\d[\d,]*(?:\.\d+)?(?:\s?(?:%|\+|x\b|k\b|K\b|M\b|Mn\b|B\b|bn\b|Cr\b|crore\b|lakh\b|L\b|hrs?\b|hours\b|days\b|weeks\b|months\b|years\b|yrs\b))?|\[[^\]]{1,12}\]/g;

export function splitMetrics(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let last = 0;
  for (const m of text.matchAll(METRIC)) {
    const value = m[0];
    // a bare 4-digit year is not a metric
    if (/^(19|20)\d{2}$/.test(value)) continue;
    if (m.index! > last) runs.push({ text: text.slice(last, m.index) });
    runs.push({ text: value, bold: true });
    last = m.index! + value.length;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs.length ? runs : [{ text }];
}

/** Placeholders such as [X%] or [N] that the AI leaves for the user to fill in. */
export const PLACEHOLDER = /\[(?:X|N|#|\$|₹|__+|\d*\s?%|[A-Z]{1,3}%?)[^\]]{0,8}\]/g;

export function countPlaceholders(resume: Resume): number {
  return [...resume.work, ...resume.projects].reduce((n, e) => n + e.highlights.reduce((m, h) => m + (h.match(PLACEHOLDER)?.length ?? 0), 0), 0);
}

export function hasMetric(text: string): boolean {
  return splitMetrics(text).some((r) => r.bold && !/^(19|20)\d{2}$/.test(r.text));
}

/**
 * Rule-based auto-confirmation: a missing JD skill counts as evidenced when every significant
 * word of it appears in one line of the resume ("supply chain management" ← "managed the supply chain").
 */
export function inferSkillsFromResume(resume: Resume, missing: string[]): { skill: string; evidence: string }[] {
  const lines = [
    ...resume.work.flatMap((w) => [w.position, w.summary, ...w.highlights]),
    ...resume.projects.flatMap((p) => [p.description, ...p.highlights]),
    resume.basics.summary,
    ...resume.certificates,
  ].filter((l): l is string => !!l);
  const out: { skill: string; evidence: string }[] = [];
  for (const skill of missing) {
    const words = tokens(skill).map(stem).filter((w) => w.length > 2);
    if (words.length < 2) continue; // single words ("Coupa") need a literal mention, which would already be covered
    // compare 5-letter roots so "management" matches "managed" and "supply" matches "supplier"
    const root = (w: string) => w.slice(0, 5);
    const line = lines.find((l) => {
      const ls = new Set(tokens(l).map((t) => root(stem(t))));
      return words.every((w) => ls.has(root(w)));
    });
    if (line) out.push({ skill, evidence: line });
  }
  return out;
}
