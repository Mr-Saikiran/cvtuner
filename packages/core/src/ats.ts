import { estimateYears } from "./coverLetter";
import { countPlaceholders, hasMetric } from "./metrics";
import { matchScore } from "./tailor";
import type { TailorResult } from "./tailor";
import { allSkills, type Resume } from "./schema";
import { stemSet } from "./text";

export type CheckStatus = "pass" | "warn" | "fail";

export interface AtsCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface AtsReport {
  score: number;
  checks: AtsCheck[];
}

export interface AtsContext {
  pages?: number;
  /** false for sidebar / two-column templates */
  singleColumn?: boolean;
}

const WEIGHT: Record<string, number> = { keywords: 30, title: 8, contact: 8, sections: 10, dates: 8, metrics: 12, bullets: 6, length: 6, layout: 6, skillsFirst: 4, placeholders: 2 };

/**
 * Applicant Tracking System readiness, the way most ATS parsers and recruiter searches see a resume:
 * keyword coverage, standard sections, parseable contact details and dates, quantified results, length and layout.
 */
export function atsReport(resume: Resume, result: TailorResult, ctx: AtsContext = {}): AtsReport {
  const checks: AtsCheck[] = [];
  const add = (id: string, label: string, status: CheckStatus, detail: string) => checks.push({ id, label, status, detail });

  const kw = matchScore(resume, result.jd.items.map((i) => i.text).join("\n"));
  add(
    "keywords",
    "Keyword match",
    kw.score >= 65 ? "pass" : kw.score >= 45 ? "warn" : "fail",
    `${kw.score}% of the job's weighted keywords appear in your resume.${kw.missing.length ? ` Missing: ${kw.missing.join(", ")}.` : ""}`,
  );

  const title = result.jd.title;
  if (title) {
    const t = stemSet(title);
    const where = stemSet([resume.basics.label, resume.basics.summary, ...resume.work.map((w) => w.position)].join(" "));
    const hit = [...t].filter((x) => where.has(x)).length / Math.max(1, t.size);
    add("title", "Job title", hit >= 0.5 ? "pass" : "warn", hit >= 0.5 ? `Your headline or roles echo “${title}”.` : `Recruiters search by title. Use “${title}” (or close wording) in your headline if it is accurate.`);
  }

  const b = resume.basics;
  const contactMissing = [!b.email && "email", !b.phone && "phone", !b.location && "location"].filter(Boolean);
  add("contact", "Contact details", contactMissing.length === 0 ? "pass" : contactMissing.includes("email") ? "fail" : "warn", contactMissing.length ? `Add your ${contactMissing.join(" and ")}.` : "Email, phone and location are present as plain text.");

  const missingSections = [!resume.work.length && "Experience", !resume.education.length && "Education", !allSkills(resume).length && "Skills"].filter(Boolean);
  add("sections", "Standard sections", missingSections.length ? "fail" : "pass", missingSections.length ? `Add ${missingSections.join(", ")} — ATS parsers look for these headings.` : "Summary, Skills, Experience and Education use headings ATS parsers recognise.");

  const undated = resume.work.filter((w) => !w.startDate || !w.endDate);
  add("dates", "Dates on every role", undated.length ? "warn" : "pass", undated.length ? `${undated.length} role${undated.length > 1 ? "s have" : " has"} no start or end date.` : `Every role has dates (${estimateYears(resume)}+ years detected).`);

  const bullets = [...resume.work, ...resume.projects].flatMap((e) => e.highlights);
  const withMetrics = bullets.filter(hasMetric).length;
  const ratio = bullets.length ? withMetrics / bullets.length : 0;
  add("metrics", "Quantified results", ratio >= 0.4 ? "pass" : ratio >= 0.2 ? "warn" : "fail", `${withMetrics} of ${bullets.length} bullets include a number, percentage or amount. Aim for at least 40%.`);

  const long = bullets.filter((h) => h.split(/\s+/).length > 35).length;
  add("bullets", "Bullet length", long ? "warn" : "pass", long ? `${long} bullet${long > 1 ? "s are" : " is"} over 35 words. Shorter lines scan better.` : "Bullets are short enough to scan.");

  if (ctx.pages) add("length", "Length", ctx.pages <= 2 ? "pass" : "warn", `${ctx.pages} page${ctx.pages > 1 ? "s" : ""}. ${ctx.pages <= 2 ? "Good." : "Two pages is safer for most roles."}`);

  add(
    "layout",
    "Layout",
    ctx.singleColumn === false ? "warn" : "pass",
    ctx.singleColumn === false
      ? "This template has a sidebar. Modern ATS read it fine, but some older systems mix up columns — the Word export is always single column."
      : "Single column, real text, standard fonts — safe for every ATS.",
  );

  const top = allSkills(resume).slice(0, 5).map((s) => s.toLowerCase());
  const jdSkills = result.keywords.filter((k) => k.known).map((k) => k.name.toLowerCase());
  const leading = top.filter((s) => jdSkills.includes(s)).length;
  add("skillsFirst", "Job skills listed first", leading >= Math.min(3, jdSkills.length) ? "pass" : "warn", leading ? `${leading} of your first 5 skills are skills this job asks for.` : "Put the job's skills at the start of your Skills section.");

  const ph = countPlaceholders(resume);
  if (ph) add("placeholders", "Placeholders filled", "fail", `${ph} placeholder${ph > 1 ? "s" : ""} like [X%] still ${ph > 1 ? "need" : "needs"} your real numbers.`);

  const total = checks.reduce((n, c) => n + (WEIGHT[c.id] ?? 5), 0);
  const got = checks.reduce((n, c) => n + (WEIGHT[c.id] ?? 5) * (c.status === "pass" ? 1 : c.status === "warn" ? 0.5 : 0), 0);
  return { score: Math.round((got / total) * 100), checks };
}

export interface ScreenedCandidate {
  id: string;
  name: string;
  fileName: string;
  headline?: string;
  email?: string;
  score: number;
  years: number;
  matched: string[];
  missing: string[];
}

/** Recruiter side: rank many resumes against one job description. */
export function screenCandidates(jdText: string, candidates: { id: string; fileName: string; resume: Resume }[], mustHave: string[] = []): ScreenedCandidate[] {
  return candidates
    .map(({ id, fileName, resume }) => {
      const { score, allMissing: missing, matched } = matchScore(resume, jdText);
      const lacksMust = mustHave.filter((m) => missing.some((x) => x.toLowerCase() === m.toLowerCase()) || !matched.some((x) => x.toLowerCase() === m.toLowerCase()));
      return {
        id,
        fileName,
        name: resume.basics.name || fileName,
        headline: resume.basics.label ?? resume.work[0]?.position,
        email: resume.basics.email,
        score: lacksMust.length ? Math.round(score * 0.5) : score,
        years: estimateYears(resume),
        matched,
        missing: [...new Set([...lacksMust, ...missing])],
      };
    })
    .sort((a, b) => b.score - a.score || b.years - a.years);
}

