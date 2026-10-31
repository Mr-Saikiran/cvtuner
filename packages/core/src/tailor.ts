import { parseJd, findTerms, type JdKeyword, type JdPhrase, type ParsedJd } from "./jd";
import { allSkills, newId, resumeText, type Resume } from "./schema";
import { buildIndex } from "./taxonomy";
import { containsTerm, stemSet } from "./text";
import { frameSentence, frameSkillsSummary, type Voice } from "./voice";

export type Coverage = "covered" | "missing";

export interface KeywordMatch extends JdKeyword {
  coverage: Coverage;
  /** user said "I have this" for a missing keyword */
  confirmed: boolean;
}

export type Suggestion =
  | { id: string; kind: "add-bullet"; targetId: string; targetLabel: string; text: string; source: string; keywords: string[]; accepted: boolean }
  | { id: string; kind: "add-skills"; skills: string[]; accepted: boolean }
  | { id: string; kind: "reorder-skills"; order: string[]; accepted: boolean }
  | { id: string; kind: "summary"; text: string; accepted: boolean; /** replace the summary instead of appending */ replace?: boolean };

export interface TailorOptions {
  voice?: Voice;
  /** skills the user confirmed they have, even though the profile does not mention them */
  confirmedSkills?: string[];
  extraTerms?: string[];
  /** max new bullets to suggest */
  maxBullets?: number;
}

export interface TailorResult {
  jd: ParsedJd;
  keywords: KeywordMatch[];
  /** 0–100, weighted share of JD keywords present in the profile (before tailoring) */
  score: number;
  /** 0–100, weighted share present after accepted suggestions are applied */
  projectedScore: number;
  gaps: KeywordMatch[];
  suggestions: Suggestion[];
}

const jaccard = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
};

const overlap = (a: Set<string>, b: Set<string>) => {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
};

function weightedScore(keywords: { weight: number; name: string }[], has: (name: string) => boolean): number {
  const total = keywords.reduce((s, k) => s + k.weight, 0);
  if (!total) return 0;
  const got = keywords.filter((k) => has(k.name)).reduce((s, k) => s + k.weight, 0);
  return Math.round((got / total) * 100);
}

/**
 * Rule-based tailoring. Never invents facts: a JD phrase only becomes a bullet when the
 * profile already shows the skills/work behind it, or the user confirmed the skill.
 */
export function tailor(resume: Resume, jdText: string, opts: TailorOptions = {}): TailorResult {
  const voice = opts.voice ?? "passive";
  const confirmed = new Set((opts.confirmedSkills ?? []).map((s) => s.toLowerCase()));
  const jd = parseJd(jdText, { extraTerms: opts.extraTerms });
  const text = resumeText(resume);
  const index = buildIndex([...(opts.extraTerms ?? []), ...allSkills(resume)]);
  const profileTerms = new Set(findTerms(text, index).map((t) => t.toLowerCase()));
  const inProfile = (name: string) => profileTerms.has(name.toLowerCase()) || containsTerm(text, name);

  const keywords: KeywordMatch[] = jd.keywords.map((k) => ({
    ...k,
    coverage: inProfile(k.name) ? "covered" : "missing",
    confirmed: confirmed.has(k.name.toLowerCase()),
  }));
  const usable = (name: string) => inProfile(name) || confirmed.has(name.toLowerCase());
  const gaps = keywords.filter((k) => k.coverage === "missing" && !k.confirmed);

  const suggestions: Suggestion[] = [];

  // 1. bullets from JD action phrases
  const entries = [
    ...resume.work.map((w, i) => ({
      id: w.id,
      label: [w.position, w.name].filter(Boolean).join(" · ") || "Experience",
      stems: stemSet([w.position, w.summary, ...w.highlights].join(" ")),
      bullets: w.highlights.map((h) => stemSet(h)),
      recency: i,
    })),
    ...resume.projects.map((p, i) => ({
      id: p.id,
      label: p.name || "Project",
      stems: stemSet([p.name, p.description, ...p.highlights].join(" ")),
      bullets: p.highlights.map((h) => stemSet(h)),
      recency: resume.work.length + i,
    })),
  ];
  const profileStems = stemSet(text);

  if (entries.length) {
    const maxBullets = opts.maxBullets ?? 6;
    const perEntry = new Map<string, number>();
    for (const phrase of jd.phrases) {
      if (suggestions.length >= maxBullets) break;
      if (!isTruthful(phrase, usable, profileStems)) continue;
      const pStems = stemSet(phrase.text);
      // already said in the resume?
      if (entries.some((e) => e.bullets.some((b) => jaccard(b, pStems) > 0.5))) continue;
      const best = entries
        .map((e) => ({ e, s: overlap(e.stems, pStems) * 2 + phrase.keywords.filter((k) => containsTerm([...e.stems].join(" "), k.toLowerCase())).length - e.recency * 0.3 }))
        .sort((a, b) => b.s - a.s)[0]!.e;
      // spread new bullets out so one role does not balloon
      if ((perEntry.get(best.id) ?? 0) >= 3) continue;
      perEntry.set(best.id, (perEntry.get(best.id) ?? 0) + 1);
      suggestions.push({
        id: newId("sug"),
        kind: "add-bullet",
        targetId: best.id,
        targetLabel: best.label,
        text: frameSentence(phrase.text, voice),
        source: phrase.source,
        keywords: phrase.keywords,
        accepted: true,
      });
    }
  }

  // 2. confirmed-but-missing skills go into the skills section
  const toAdd = keywords.filter((k) => k.coverage === "missing" && k.confirmed).map((k) => k.name);
  if (toAdd.length) suggestions.push({ id: newId("sug"), kind: "add-skills", skills: toAdd, accepted: true });

  // 3. put JD-relevant skills first (ATS and humans both read left to right)
  const jdOrder = keywords.map((k) => k.name.toLowerCase());
  const current = allSkills(resume);
  const reordered = [...current].sort((a, b) => rank(a) - rank(b));
  function rank(s: string) {
    const i = jdOrder.indexOf(s.toLowerCase());
    return i === -1 ? 1000 + current.indexOf(s) : i;
  }
  if (reordered.join("|") !== current.join("|")) {
    suggestions.push({ id: newId("sug"), kind: "reorder-skills", order: reordered, accepted: true });
  }

  // 4. a summary line naming the top matched skills
  const topMatched = keywords.filter((k) => k.known && usable(k.name)).slice(0, 5).map((k) => k.name);
  if (topMatched.length >= 2) {
    suggestions.push({ id: newId("sug"), kind: "summary", text: frameSkillsSummary(topMatched, voice), accepted: true });
  }

  const score = weightedScore(keywords, inProfile);
  const projectedScore = weightedScore(keywords, (n) => usable(n) || suggestions.some((s) => s.kind === "add-bullet" && s.keywords.includes(n)));
  return { jd, keywords, score, projectedScore, gaps, suggestions };
}

function isTruthful(phrase: JdPhrase, usable: (n: string) => boolean, profileStems: Set<string>): boolean {
  if (phrase.keywords.length) {
    // every named skill in the phrase must be backed by the profile or a confirmation
    return phrase.keywords.every(usable);
  }
  // no named skills: require real overlap with what the person has done
  const stems = stemSet(phrase.text);
  return stems.size > 0 && overlap(stems, profileStems) / stems.size >= 0.5;
}

/** Applies accepted suggestions and returns a new resume (input is not mutated). */
export function applySuggestions(resume: Resume, suggestions: Suggestion[]): Resume {
  const out: Resume = structuredClone(resume);
  for (const s of suggestions) {
    if (!s.accepted) continue;
    switch (s.kind) {
      case "add-bullet": {
        const target = out.work.find((w) => w.id === s.targetId) ?? out.projects.find((p) => p.id === s.targetId);
        target?.highlights.push(s.text);
        break;
      }
      case "add-skills": {
        // newly confirmed JD skills go to the front of the first group, where ATS and recruiters look first
        if (!out.skills.length) out.skills.push({ id: newId("skill"), name: "Skills", keywords: [] });
        const have = new Set(allSkills(out).map((k) => k.toLowerCase()));
        out.skills[0]!.keywords.unshift(...s.skills.filter((k) => !have.has(k.toLowerCase())));
        break;
      }
      case "reorder-skills": {
        const rank = new Map(s.order.map((k, i) => [k.toLowerCase(), i]));
        // skills missing from the saved order were just added for this JD, so they stay in front
        for (const g of out.skills) g.keywords.sort((a, b) => (rank.get(a.toLowerCase()) ?? -1) - (rank.get(b.toLowerCase()) ?? -1));
        break;
      }
      case "summary": {
        out.basics.summary = s.replace ? s.text : [out.basics.summary?.trim(), s.text].filter(Boolean).join(" ");
        break;
      }
    }
  }
  return out;
}

/**
 * Priority of every bullet for page-fit trimming: higher = keep.
 * Relevance to the JD dominates; recency breaks ties; tailored bullets are protected.
 */
export interface BulletRef {
  entryId: string;
  index: number;
  score: number;
}

export function bulletPriorities(resume: Resume, jdKeywords: string[], protectedTexts: string[] = []): BulletRef[] {
  const kws = jdKeywords.map((k) => k.toLowerCase());
  const kwStems = stemSet(jdKeywords.join(" "));
  const prot = new Set(protectedTexts);
  const refs: BulletRef[] = [];
  const score = (text: string, recency: number) => {
    const hits = kws.filter((k) => containsTerm(text, k)).length;
    const stemHits = overlap(stemSet(text), kwStems);
    return (prot.has(text) ? 100 : 0) + hits * 3 + stemHits + 5 / (1 + recency);
  };
  resume.work.forEach((w, wi) => w.highlights.forEach((h, i) => refs.push({ entryId: w.id, index: i, score: score(h, wi) - i * 0.1 })));
  resume.projects.forEach((p, pi) =>
    p.highlights.forEach((h, i) => refs.push({ entryId: p.id, index: i, score: score(h, resume.work.length + pi) - 1 - i * 0.1 })),
  );
  return refs.sort((a, b) => a.score - b.score);
}

/** Removes bullets (lowest priority first), always keeping at least one bullet per entry. */
export function dropBullets(resume: Resume, ordered: BulletRef[], count: number): Resume {
  const out: Resume = structuredClone(resume);
  const remove = new Map<string, Set<number>>();
  const remaining = new Map<string, number>();
  for (const e of [...out.work, ...out.projects]) remaining.set(e.id, e.highlights.length);
  let removed = 0;
  for (const ref of ordered) {
    if (removed >= count) break;
    if ((remaining.get(ref.entryId) ?? 0) <= 1) continue;
    if (!remove.has(ref.entryId)) remove.set(ref.entryId, new Set());
    remove.get(ref.entryId)!.add(ref.index);
    remaining.set(ref.entryId, remaining.get(ref.entryId)! - 1);
    removed++;
  }
  for (const e of [...out.work, ...out.projects]) {
    const r = remove.get(e.id);
    if (r) e.highlights = e.highlights.filter((_, i) => !r.has(i));
  }
  return out;
}

export function removableBulletCount(resume: Resume): number {
  return [...resume.work, ...resume.projects].reduce((n, e) => n + Math.max(0, e.highlights.length - 1), 0);
}

/** Fast keyword-coverage score (0–100) for ranking many postings or many resumes. */
export function matchScore(
  resume: Resume,
  jdText: string,
  confirmedSkills: string[] = [],
): { score: number; missing: string[]; matched: string[]; allMissing: string[] } {
  const jd = parseJd(jdText, { phrases: false });
  const text = resumeText(resume);
  const index = buildIndex(allSkills(resume));
  const profileTerms = new Set(findTerms(text, index).map((t) => t.toLowerCase()));
  const confirmed = new Set(confirmedSkills.map((s) => s.toLowerCase()));
  const has = (n: string) => profileTerms.has(n.toLowerCase()) || containsTerm(text, n) || confirmed.has(n.toLowerCase());
  const allMissing = jd.keywords.filter((k) => k.known && !has(k.name)).map((k) => k.name);
  return {
    score: weightedScore(jd.keywords, has),
    missing: allMissing.slice(0, 6),
    allMissing,
    matched: jd.keywords.filter((k) => has(k.name)).map((k) => k.name),
  };
}
