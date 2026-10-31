import { newId, type Resume } from "./schema";

type Section = "summary" | "work" | "education" | "skills" | "projects" | "certificates" | "languages" | "other";

const SECTION_HEADERS: [Section, RegExp][] = [
  ["summary", /^(summary|profile|professional summary|about me|objective|career objective|overview)$/i],
  ["work", /^(experience|work experience|professional experience|employment( history)?|work history|career history|relevant experience)$/i],
  ["education", /^(education|academic background|qualifications|education and training)$/i],
  ["skills", /^(skills|technical skills|core skills|key skills|core competencies|competencies|technologies|tools|skills & tools|areas of expertise)$/i],
  ["projects", /^(projects|personal projects|key projects|selected projects)$/i],
  ["certificates", /^(certifications?|licenses?( (and|&) certifications)?|courses|awards)$/i],
  ["languages", /^(languages|languages known|language skills)$/i],
  ["other", /^(interests|hobbies|references|volunteering|publications)$/i],
];

const BULLET = /^\s*([-*•●◦▪‣–·]|\d+[.)])\s*/;
const DATE = /((jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?(19|20)\d{2}|present|current|now/gi;
const DATE_RANGE = new RegExp(`(${DATE.source})\\s*(?:[-–—]|to)\\s*(${DATE.source})`, "i");
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE = /(\+?\d[\d\s().-]{8,}\d)/;
const URL_RE = /(https?:\/\/\S+|(?:www\.)?(?:linkedin\.com|github\.com)\/\S+)/i;

function headerOf(line: string): Section | null {
  const clean = line.replace(/[:|#*_]/g, "").trim();
  if (clean.length > 40) return null;
  for (const [s, re] of SECTION_HEADERS) if (re.test(clean)) return s;
  return null;
}

/**
 * Best-effort conversion of plain resume text (extracted from PDF/DOCX) into the resume schema.
 * The UI always shows the result for review — this only needs to get the user most of the way.
 */
export function parseResumeText(raw: string): Resume {
  const lines = raw
    .replace(/\r/g, "")
    .replace(/(\p{Ll})- (\p{Ll})/gu, "$1$2") // words hyphenated across lines by PDF layout
    .split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const resume: Resume = { basics: { name: "" }, work: [], education: [], projects: [], skills: [], certificates: [], languages: [] };

  let section: Section | "header" = "header";
  const summary: string[] = [];
  const skillWords: string[] = [];

  for (const line of lines) {
    const h = headerOf(line);
    if (h) {
      section = h;
      continue;
    }
    if (section === "header") {
      if (!resume.basics.email && EMAIL.test(line)) resume.basics.email = line.match(EMAIL)![0];
      if (!resume.basics.phone && PHONE.test(line)) resume.basics.phone = line.match(PHONE)![0].trim();
      if (!resume.basics.url && URL_RE.test(line)) resume.basics.url = line.match(URL_RE)![0];
      const plain = line.replace(EMAIL, "").replace(PHONE, "").replace(URL_RE, "").replace(/[|•,]+/g, " ").trim();
      if (!resume.basics.name && plain && plain.split(" ").length <= 5) resume.basics.name = plain;
      else if (resume.basics.name && !resume.basics.label && plain && plain.length < 80 && !EMAIL.test(line)) resume.basics.label = plain;
      continue;
    }
    const isBullet = BULLET.test(line);
    const content = line.replace(BULLET, "").trim();
    switch (section) {
      case "summary":
        summary.push(content);
        break;
      case "skills":
        skillWords.push(...content.replace(/^[^:]{1,30}:\s*/, "").split(/[,;|•·]\s*/).map((s) => s.trim()).filter((s) => s && s.length < 40));
        break;
      case "certificates":
        resume.certificates.push(content);
        break;
      case "languages":
        resume.languages.push(...content.split(/[,;|•·]\s*/).map((l) => l.trim()).filter(Boolean));
        break;
      case "work": {
        const last = resume.work[resume.work.length - 1];
        // DOCX/PDF text often loses bullet glyphs: a sentence-like line with no dates is a highlight
        const sentenceLike = content.length > 70 || (/[.!]$/.test(content) && !DATE_RANGE.test(content) && content.split(" ").length >= 5);
        if (isBullet || (last && sentenceLike)) {
          if (last) last.highlights.push(content);
          else resume.work.push({ id: newId("work"), name: "", position: "", highlights: [content] });
        } else if (last && !last.startDate && DATE_RANGE.test(content) && content.replace(DATE_RANGE, "").trim().length < 3) {
          [last.startDate, last.endDate] = dates(content);
        } else if (last && last.highlights.length === 0 && !last.name) {
          last.name = content.replace(DATE_RANGE, "").replace(/[|,–-]\s*$/, "").trim();
          if (!last.startDate && DATE_RANGE.test(content)) [last.startDate, last.endDate] = dates(content);
        } else {
          const [position, name] = splitRole(content.replace(DATE_RANGE, "").trim());
          const [startDate, endDate] = DATE_RANGE.test(content) ? dates(content) : [undefined, undefined];
          resume.work.push({ id: newId("work"), position, name, startDate, endDate, highlights: [] });
        }
        break;
      }
      case "projects": {
        const last = resume.projects[resume.projects.length - 1];
        if (isBullet && last) last.highlights.push(content);
        else if (last && !last.description && content.length > 60) last.description = content;
        else resume.projects.push({ id: newId("proj"), name: content, highlights: [] });
        break;
      }
      case "education": {
        const last = resume.education[resume.education.length - 1];
        const [startDate, endDate] = DATE_RANGE.test(content) ? dates(content) : [undefined, content.match(DATE)?.[0]];
        const clean = content.replace(DATE_RANGE, "").replace(DATE, "").replace(/[|,–-]\s*$/, "").trim();
        if (last && !last.area && clean && !isBullet && !/university|college|institute|school|academy/i.test(clean)) {
          last.area = clean;
        } else if (clean) {
          resume.education.push({ id: newId("edu"), institution: clean, startDate, endDate });
        }
        break;
      }
      default:
        break;
    }
  }
  // sidebar layouts put contact details before the name, so the first short line can be a
  // heading like "CONTACT" or a city. If the email names the person, prefer the line that matches it.
  const emailParts = (resume.basics.email?.split("@")[0] ?? "").toLowerCase().split(/[._-]+/).filter((p) => p.length >= 3);
  const nameLike = (l: string) => /^[\p{L}][\p{L}.' -]{1,60}$/u.test(l) && l.split(" ").length <= 5 && !headerOf(l);
  const matchesEmail = (l: string) => emailParts.some((p) => l.toLowerCase().split(/[\s.'-]+/).includes(p));
  if (emailParts.length && !(resume.basics.name && matchesEmail(resume.basics.name))) {
    const better = lines.find((l) => nameLike(l) && matchesEmail(l));
    if (better) resume.basics.name = better;
  }
  if (/^(contact|contact details|details|personal details)$/i.test(resume.basics.name)) resume.basics.name = "";
  resume.basics.summary = summary.join(" ") || undefined;
  if (skillWords.length) resume.skills.push({ id: newId("skill"), name: "Skills", keywords: [...new Set(skillWords)] });
  return resume;
}

function dates(s: string): [string | undefined, string | undefined] {
  const m = s.match(DATE_RANGE);
  if (!m) return [undefined, undefined];
  const parts = m[0].split(/\s*(?:[-–—]|\bto\b)\s*/i);
  return [parts[0]?.trim(), parts[parts.length - 1]?.trim()];
}

function splitRole(s: string): [string, string] {
  const at = s.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
  if (at) return [at[1]!.trim(), at[2]!.trim()];
  const parts = s.split(/\s*[|–—,]\s*|\s+-\s+/).filter(Boolean);
  return [parts[0] ?? s, parts.slice(1).join(", ")];
}
