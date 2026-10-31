/** Text helpers shared by the parser and the matcher. */

const STOPWORDS = new Set(
  "a an and are as at be by for from has have in into is it its of on or our that the their this to was we were will with you your who what which within across over per via etc able ability strong excellent good great proven experience experienced years year plus including include includes using use used work working team teams role must should would can could may new well".split(
    " ",
  ),
);

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9+#./\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Very small suffix stemmer; good enough to equate "managing", "managed", "manages". */
export function stem(word: string): string {
  const w = word.toLowerCase();
  if (w.length <= 4) return w;
  for (const suf of ["ations", "ation", "ments", "ment", "ings", "ing", "ies", "ers", "er", "ed", "es", "s"]) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) {
      return suf === "ies" ? w.slice(0, -3) + "y" : w.slice(0, -suf.length);
    }
  }
  return w;
}

export function tokens(s: string): string[] {
  return normalize(s)
    .split(" ")
    .map((t) => t.replace(/^[.\-/]+|[.\-/]+$/g, ""))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export function stemSet(s: string): Set<string> {
  return new Set(tokens(s).map(stem));
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-term, case-insensitive containment that works for terms like "c++", "node.js", "ci/cd". */
export function containsTerm(haystack: string, term: string): boolean {
  const re = new RegExp(`(^|[^a-z0-9+#])${escapeRegExp(term.toLowerCase())}($|[^a-z0-9+#])`, "i");
  return re.test(haystack.toLowerCase());
}

export function capitalize(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}

export function uniqueBy<T>(items: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((it) => {
    const k = key(it);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
