import { buildIndex, isCaseSensitive, type TermIndex } from "./taxonomy";
import { containsTerm, escapeRegExp, normalize, stemSet, uniqueBy } from "./text";
import { toActionPhrase } from "./voice";

export type JdSection = "intro" | "responsibilities" | "requirements" | "nice" | "other";

export interface JdItem {
  text: string;
  section: JdSection;
}

export interface JdKeyword {
  name: string;
  weight: number;
  sections: JdSection[];
  /** true when found via the taxonomy, false when detected heuristically (acronym / product name) */
  known: boolean;
}

export interface JdPhrase {
  /** imperative action phrase, e.g. "manage vendor contracts and reduce costs" */
  text: string;
  source: string;
  section: JdSection;
  keywords: string[];
  weight: number;
}

export interface ParsedJd {
  title?: string;
  company?: string;
  items: JdItem[];
  keywords: JdKeyword[];
  phrases: JdPhrase[];
}

const SECTION_WEIGHT: Record<JdSection, number> = {
  requirements: 3,
  responsibilities: 2,
  intro: 1,
  nice: 1,
  other: 0,
};

const HEADERS: [JdSection, RegExp][] = [
  ["nice", /\b(nice[- ]to[- ]have|preferred|bonus|desirable|good to have|pluses?|it'?s a plus)\b/i],
  ["other", /\b(benefits|perks|what we offer|why join|about (us|the company)|who we are|our (values|culture|mission)|equal opportunit|compensation|salary|how to apply|location|eeo)\b/i],
  ["responsibilities", /\b(responsibilit|what you('| wi)ll do|the role|your role|role overview|duties|key accountabilit|day[- ]to[- ]day|your impact|what you will be doing|job description|key tasks|in this role)\b/i],
  ["requirements", /\b(requirements|qualifications|what you('| wi)ll (bring|need)|must[- ]have|skills|who you are|what we('re| are) looking for|about you|you have|experience required|competenc|eligibility)\b/i],
];

const BULLET = /^\s*([-*•●◦▪‣–·]|\d+[.)]|[a-z][.)])\s+/;

function isHeader(line: string): JdSection | null {
  const clean = line.replace(/[:#*_]+/g, " ").trim();
  if (!clean || clean.length > 60 || BULLET.test(line)) return null;
  // headers are short and usually end with ":" or are title-ish
  const wordCount = clean.split(/\s+/).length;
  if (wordCount > 8) return null;
  for (const [section, re] of HEADERS) if (re.test(clean)) return section;
  return null;
}

/** Splits a raw JD (plain text or text copied from HTML) into sectioned items. */
export function splitJd(raw: string): { items: JdItem[]; title?: string; company?: string } {
  const text = raw
    .replace(/<\/(p|li|div|h\d)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\r/g, "");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  let section: JdSection = "intro";
  const items: JdItem[] = [];
  for (const line of lines) {
    const header = isHeader(line);
    if (header) {
      section = header;
      // "Requirements: 5+ years of X" — keep the trailing content as an item
      const after = line.split(":").slice(1).join(":").trim();
      if (after.length > 3) items.push({ text: after, section });
      continue;
    }
    const content = line.replace(BULLET, "").trim();
    // split paragraphs into sentences so each one can become a phrase
    const parts = BULLET.test(line) ? [content] : content.split(/(?<=[.!?])\s+(?=[A-Z])/);
    for (const p of parts) if (p.length > 2) items.push({ text: p, section });
  }

  const titleMatch =
    raw.match(/(?:job title|position|role)\s*[:\-–]\s*(.+)/i)?.[1] ??
    (lines[0] && lines[0].length < 80 && !isHeader(lines[0]) ? lines[0] : undefined);
  const companyMatch =
    raw.match(/(?:company|employer|organi[sz]ation)\s*[:\-–]\s*(.+)/i)?.[1] ??
    raw.match(/\babout\s+([A-Z][\w&.\- ]{1,40}?)(?:\s*[:\n]|$)/m)?.[1] ??
    raw.match(/\bat\s+([A-Z][\w&.\-]+(?:\s[A-Z][\w&.\-]+){0,3})(?=[,.\s])/)?.[1];
  const notUs = (s?: string) => (s && !/^(us|the company|the role|you)$/i.test(s.trim()) ? s.trim() : undefined);
  // "Senior Buyer — Acme Foods" / "Senior Buyer | Acme" / "Senior Buyer at Acme"
  const titleParts = titleMatch?.trim().split(/\s+[|–—-]\s+|\s+at\s+/);
  return {
    items,
    title: titleParts?.[0],
    company: notUs(companyMatch) ?? notUs(titleParts?.[1]),
  };
}

/** Words that look like product names/acronyms but are just sentence noise. */
const PROPER_NOISE = new Set(
  "We You Our The This That In As At For With And Or If It Is Are Be To Of On By An A I US USA UK EU EOE Inc Ltd LLC Pvt Monday Friday January Remote Hybrid Senior Junior Lead Manager Engineer Developer Team Role Job Experience Strong Ability Bachelor Master Degree BS MS BA MBA PhD Key Responsibilities Requirements Qualifications Benefits About Join Please Apply Equal Opportunity Must Nice Preferred Plus Years Excellent Good Work Working Help Build Design Develop Drive Own Manage Create Support Ensure Collaborate Partner Lead Deliver Maintain Use Write Knowledge Understanding Familiarity Proficiency Exposure Bonus Who What Why How When Where Your Their All Any New Other More".split(
    " ",
  ),
);

const termRe = (form: string, flags = "") =>
  new RegExp(`(^|[^A-Za-z0-9+#])${escapeRegExp(form)}(?=$|[^A-Za-z0-9+#])`, flags);

function matchesAlias(text: string, alias: string, canonical: string): boolean {
  if (!isCaseSensitive(alias, canonical)) return containsTerm(text, alias);
  return [canonical, alias.toUpperCase()].some((form) => termRe(form).test(text));
}

/** Finds known skills in a piece of text. Longest aliases win, so "React Native" is not also counted as "React". */
export function findTerms(text: string, index: TermIndex): string[] {
  let remaining = text;
  const found: string[] = [];
  for (const alias of index.aliases) {
    const canonical = index.aliasToName.get(alias)!;
    if (!remaining.toLowerCase().includes(alias)) continue;
    if (matchesAlias(remaining, alias, canonical)) {
      found.push(canonical);
      remaining = remaining.replace(termRe(alias, "ig"), "$1 ");
    }
  }
  return [...new Set(found)];
}

/** Heuristic detection of tools/standards not in the taxonomy: "NetSuite", "ServiceNow", "SOX", "HL7". */
function detectProperTerms(text: string): string[] {
  const out: string[] = [];
  const re = /(?<![.!?]\s)(?<!^)\b([A-Z][a-z]*[A-Z][A-Za-z0-9]*|[A-Z]{2,6}[0-9]*|[A-Z][a-z]+\d+)\b/g;
  for (const m of text.matchAll(re)) {
    const w = m[1]!;
    if (!PROPER_NOISE.has(w) && w.length >= 2) out.push(w);
  }
  return out;
}

export interface ParseJdOptions {
  extraTerms?: string[];
}

export function parseJd(raw: string, opts: ParseJdOptions = {}): ParsedJd {
  const index = buildIndex(opts.extraTerms);
  const { items, title, company } = splitJd(raw);

  const kw = new Map<string, JdKeyword>();
  const add = (name: string, section: JdSection, known: boolean) => {
    const w = SECTION_WEIGHT[section];
    if (w === 0) return;
    const key = name.toLowerCase();
    const existing = kw.get(key);
    if (existing) {
      existing.weight += w * 0.5; // repeated mentions count, with diminishing effect
      if (!existing.sections.includes(section)) existing.sections.push(section);
      existing.known ||= known;
    } else kw.set(key, { name, weight: w, sections: [section], known });
  };

  const phrases: JdPhrase[] = [];
  for (const item of items) {
    const terms = findTerms(item.text, index);
    for (const t of terms) add(t, item.section, true);
    const known = new Set(terms.map((t) => t.toLowerCase()));
    for (const p of detectProperTerms(item.text)) {
      if (![...known].some((k) => k.includes(p.toLowerCase()) || p.toLowerCase().includes(k))) add(p, item.section, false);
    }

    if (item.section === "other") continue;
    const action = toActionPhrase(item.text);
    if (action) {
      phrases.push({
        text: action,
        source: item.text,
        section: item.section,
        keywords: terms,
        weight: SECTION_WEIGHT[item.section] + terms.length * 0.5,
      });
    }
  }

  // heuristic terms seen only once in the intro are usually noise (company or product names)
  const keywords = [...kw.values()]
    .filter((k) => k.known || k.weight >= 2 || k.sections.some((sec) => sec !== "intro"))
    .sort((a, b) => b.weight - a.weight);

  return {
    title,
    company,
    items,
    keywords,
    phrases: uniqueBy(phrases, (p) => [...stemSet(p.text)].sort().join(" ")).sort((a, b) => b.weight - a.weight),
  };
}

export { normalize };
