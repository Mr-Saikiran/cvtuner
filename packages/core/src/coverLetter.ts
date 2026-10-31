import type { Resume } from "./schema";
import { bulletPriorities } from "./tailor";
import type { KeywordMatch } from "./tailor";

export interface CoverLetter {
  date: string;
  recipient: string;
  greeting: string;
  paragraphs: string[];
  closing: string;
  signature: string;
}

const joinList = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/**
 * Rule-based cover letter: role + company from the JD, the strongest matched skills, and the
 * resume's most JD-relevant achievements quoted as evidence. English only; AI mode handles other languages.
 */
export function ruleCoverLetter(resume: Resume, keywords: KeywordMatch[], opts: { jobTitle?: string; company?: string; tone?: "formal" | "friendly" } = {}): CoverLetter {
  const role = opts.jobTitle || "this role";
  const company = opts.company || "your team";
  const covered = keywords.filter((k) => k.coverage === "covered" || k.confirmed).map((k) => k.name);
  const top = covered.slice(0, 4);
  const years = estimateYears(resume);
  const current = resume.work[0];

  const order = bulletPriorities(resume, keywords.map((k) => k.name)).reverse();
  const evidence: string[] = [];
  for (const ref of order) {
    const entry = resume.work.find((w) => w.id === ref.entryId) ?? resume.projects.find((p) => p.id === ref.entryId);
    const h = entry?.highlights[ref.index];
    if (h && !evidence.includes(h)) evidence.push(h.replace(/\.$/, ""));
    if (evidence.length === 2) break;
  }

  const intro =
    opts.tone === "friendly"
      ? `I was excited to see the ${role} opening at ${company}. ${current ? `As ${article(current.position)} ${current.position}${current.name ? ` at ${current.name}` : ""}` : "In my work so far"}${years ? ` with ${years}+ years of experience` : ""}, I have built exactly the kind of background this role asks for.`
      : `I am writing to apply for the ${role} position at ${company}. ${current ? `I currently work as ${article(current.position)} ${current.position}${current.name ? ` at ${current.name}` : ""}` : "My background"}${years ? `, with ${years}+ years of relevant experience` : ""}, and I believe my experience matches what you are looking for.`;

  const skillsPara = top.length
    ? `Your description puts weight on ${joinList(top)}, and these are areas where I have hands-on experience. ${evidence.length ? `For example: ${evidence.map((e) => lowerFirst(e)).join("; and ")}.` : ""}`
    : evidence.length
      ? `Some results I am proud of: ${evidence.map((e) => lowerFirst(e)).join("; and ")}.`
      : "";

  const close =
    opts.tone === "friendly"
      ? `I would love to bring this experience to ${company} and talk about how I can help. Thank you for your time.`
      : `I would welcome the opportunity to discuss how I can contribute to ${company}. Thank you for considering my application.`;

  return {
    date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    recipient: opts.company ? `Hiring Team, ${opts.company}` : "Hiring Team",
    greeting: "Dear Hiring Manager,",
    paragraphs: [intro, skillsPara, close].filter(Boolean),
    closing: opts.tone === "friendly" ? "Best regards," : "Sincerely,",
    signature: resume.basics.name,
  };
}

function article(word?: string) {
  return /^[aeiou]/i.test(word ?? "") ? "an" : "a";
}

function lowerFirst(s: string) {
  // keep acronyms like "SAP" intact
  return /^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1);
}

export function estimateYears(resume: Resume): number {
  const years = resume.work
    .flatMap((w) => [w.startDate, w.endDate])
    .map((d) => (d && /present|current|now/i.test(d) ? new Date().getFullYear() : Number(d?.match(/(19|20)\d{2}/)?.[0])))
    .filter((y) => y && !Number.isNaN(y)) as number[];
  if (years.length < 2) return 0;
  return Math.max(0, Math.max(...years) - Math.min(...years));
}
