import { newId, type CustomSection, type Resume, type Work } from "./schema";

type Section = "summary" | "work" | "education" | "skills" | "projects" | "certificates" | "languages" | "custom" | "contact";

interface Header {
  section: Section;
  /** heading as written, used to name skill groups and custom sections */
  title: string;
  kind?: "list" | "text";
  placement?: "main" | "side";
}

const SECTION_HEADERS: [Section, RegExp, Partial<Header>?][] = [
  ["summary", /^(summary|profile|professional summary|about me|about|objective|career objective|overview|professional profile)$/i],
  ["work", /^(experience|work experience|professional experience|employment( history)?|work history|career history|relevant experience)$/i],
  ["education", /^(education|academic background|academics|qualifications|education and training|academic qualifications)$/i],
  ["skills", /^(skills|technical skills|core skills|key skills|core competencies|competencies|technologies|tools|skills & tools|areas of expertise|tech stack|technical stack|tools & technologies|expertise)$/i],
  ["projects", /^(projects|personal projects|key projects|selected projects)$/i],
  ["certificates", /^(certifications?|licenses?( (and|&) certifications)?|courses)$/i],
  ["languages", /^(languages|languages known|language skills)$/i],
  ["contact", /^(contact|contact details|contact info|personal details|details)$/i],
  ["custom", /^(achievements|awards|honou?rs|awards (and|&) achievements|accomplishments|key achievements)$/i, { kind: "list", placement: "side" }],
  ["custom", /^(declaration)$/i, { kind: "text", placement: "main" }],
  ["custom", /^(interests|hobbies|references|volunteering|volunteer experience|publications|patents|memberships|extracurricular activities)$/i, { kind: "list", placement: "main" }],
];

const COMPOUND_LEFT = /^(high|low|well|end|self|cross|real|full|part|long|short|multi|non|co|pre|post|data|cloud|event|cost|time|data|user|role|test|open|top|first|best|award|world|state|in|on|off|third|two|three|four|five)$/i;
const BULLET = /^\s*([-*•●◦▪‣–·]|\d+[.)])\s*/;
const MONTH = "(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const DATE_SRC = `((${MONTH}\\s+)?(19|20)\\d{2}|present|current|now|till date|to date)`;
const DATE = new RegExp(DATE_SRC, "gi");
const DATE_RANGE = new RegExp(`${DATE_SRC}\\s*(?:[-–—]|to)\\s*${DATE_SRC}`, "i");
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE = /(\+?\d[\d\s().-]{8,}\d)/;
const URL_RE = /(https?:\/\/\S+|(?:www\.)?(?:linkedin\.com|github\.com)\/\S+|\bin\/[\w-]{3,})/i;
const DEGREE = /\b(master(?:'s|’s|s)?|bachelor(?:'s|’s|s)?|b\.?\s?tech|m\.?\s?tech|b\.?\s?e\b|m\.?\s?e\b|b\.?\s?sc|m\.?\s?sc|bsc|msc|mba|bba|bca|mca|ph\.?d|diploma|degree|associate|ssc|hsc|intermediate|higher secondary|\bba\b|\bma\b|\bbs\b|\bms\b)/i;
const INSTITUTION = /\b(university|college|institute|school|academy|iit|nit|iim|vidyalaya|polytechnic)\b/i;
const COMPANY_HINT = /\s\|\s|\bclients?\b|\b(ltd|limited|inc|llc|pvt|corp|corporation|gmbh|plc|technologies|systems|services|solutions|consulting|labs|bank|group)\b/i;

function headerOf(line: string): Header | null {
  const clean = line.replace(/[:|#*_]/g, "").trim();
  if (clean.length > 40 || !clean) return null;
  for (const [section, re, extra] of SECTION_HEADERS) {
    if (re.test(clean)) return { section, title: titleCase(clean), ...extra };
  }
  return null;
}

function titleCase(s: string): string {
  return s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : s;
}

/** A line that is only contact details (an email, a phone number, a profile link). */
function contactOnly(line: string): boolean {
  const rest = line.replace(EMAIL, "").replace(PHONE, "").replace(URL_RE, "").replace(/[|•,·\s]+/g, "");
  return rest.length < 3 && (EMAIL.test(line) || PHONE.test(line) || URL_RE.test(line));
}

/**
 * Best-effort conversion of plain resume text (extracted from PDF/DOCX) into the resume schema.
 * Handles classic and designed layouts: date-first experience blocks, "Company | Clients – …" lines,
 * several skill groups (Skills, Tech Stack), multi-line education, and extra sections
 * (Achievements, Declaration, Interests…) which become custom sections.
 * The UI always shows the result for review.
 */
export function parseResumeText(raw: string): Resume {
  const lines = raw
    .replace(/\r/g, "")
    // a word split across lines ("manufac- turing") is rejoined; real compounds keep the hyphen ("high-performance")
    .replace(/(\p{L}+)- (\p{Ll}+)/gu, (_m, a: string, b: string) => (COMPOUND_LEFT.test(a) ? `${a}-${b}` : `${a}${b}`))
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const resume: Resume = {
    basics: { name: "" },
    work: [],
    education: [],
    projects: [],
    skills: [],
    certificates: [],
    languages: [],
    custom: [],
    layout: { order: [], hidden: [] },
  };

  let section: Section | "header" = "header";
  let header: Header | null = null;
  const summary: string[] = [];
  let skillGroup: { name: string; words: string[] } | null = null;
  const skillGroups: { name: string; words: string[] }[] = [];
  let custom: CustomSection | null = null;
  const workState = { dateFirst: false };

  const grabContact = (line: string) => {
    if (!resume.basics.email && EMAIL.test(line)) resume.basics.email = line.match(EMAIL)![0];
    if (!resume.basics.phone && PHONE.test(line)) resume.basics.phone = line.match(PHONE)![0].trim();
    if (!resume.basics.url && URL_RE.test(line)) {
      const u = line.match(URL_RE)![0];
      resume.basics.url = /^in\//.test(u) ? `linkedin.com/${u}` : u;
    }
  };

  for (const line of lines) {
    const h = headerOf(line);
    if (h) {
      section = h.section;
      header = h;
      if (h.section === "skills") {
        skillGroup = { name: h.title, words: [] };
        skillGroups.push(skillGroup);
      }
      if (h.section === "custom") {
        custom = { id: newId("sec"), title: h.title, kind: h.kind ?? "list", items: [], placement: h.placement ?? "main" };
        resume.custom.push(custom);
      }
      continue;
    }
    // contact details can sit anywhere in designed layouts (sidebars come last)
    if (contactOnly(line)) {
      grabContact(line);
      continue;
    }
    const isBullet = BULLET.test(line);
    const content = line.replace(BULLET, "").trim();

    switch (section) {
      case "header":
      case "contact": {
        grabContact(line);
        const plain = line.replace(EMAIL, "").replace(PHONE, "").replace(URL_RE, "").replace(/[|•,]+\s*$/g, "").trim();
        if (!plain) break;
        if (!resume.basics.name && plain.split(" ").length <= 5 && !/\d/.test(plain)) resume.basics.name = titleCase(plain.replace(/\.$/, "").trim());
        else if (resume.basics.name && !resume.basics.label && plain.length <= 90 && summary.length === 0 && !/[.!?]"?$/.test(plain)) resume.basics.label = plain;
        else if (resume.basics.name) summary.push(plain.replace(/^"|"$/g, ""));
        break;
      }
      case "summary":
        summary.push(content);
        break;
      case "skills": {
        const words = content
          .replace(/^[^:]{1,30}:\s*/, "")
          .split(/,(?![^()]*\))|;|\||•|·/)
          .map((s) => s.trim())
          .filter((s) => s && s.length < 45);
        (skillGroup ??= skillGroups[skillGroups.push({ name: "Skills", words: [] }) - 1]!).words.push(...words);
        break;
      }
      case "certificates":
        resume.certificates.push(content);
        break;
      case "languages":
        resume.languages.push(...content.split(/[,;|•·]\s*/).map((l) => l.trim()).filter(Boolean));
        break;
      case "custom":
        if (!custom) break;
        if (custom.kind === "text") {
          // a trailing signature line is the person's name, not part of the text
          if (resume.basics.name && content.replace(/\.$/, "").toLowerCase() === resume.basics.name.replace(/\.$/, "").toLowerCase()) break;
          custom.text = [custom.text, content].filter(Boolean).join(" ");
        } else custom.items.push(content);
        break;
      case "work":
        addWorkLine(resume.work, content, isBullet, workState);
        break;
      case "projects": {
        const last = resume.projects[resume.projects.length - 1];
        if ((isBullet || content.length > 70) && last) last.highlights.push(content);
        else if (last && !last.description && content.length > 60) last.description = content;
        else resume.projects.push({ id: newId("proj"), name: content, highlights: [] });
        break;
      }
      case "education":
        addEducationLine(resume, content);
        break;
    }
    void header;
  }

  // sidebar layouts put contact details before the name, so the first short line can be a
  // heading or a city. If the email names the person, prefer the line that matches it.
  const emailParts = (resume.basics.email?.split("@")[0] ?? "").toLowerCase().split(/[._-]+/).filter((p) => p.length >= 3);
  const nameLike = (l: string) => /^[\p{L}][\p{L}.' -]{1,60}$/u.test(l) && l.split(" ").length <= 5 && !headerOf(l);
  const matchesEmail = (l: string) => emailParts.some((p) => l.toLowerCase().split(/[\s.'-]+/).includes(p));
  if (emailParts.length && !(resume.basics.name && matchesEmail(resume.basics.name))) {
    const better = lines.find((l) => nameLike(l) && matchesEmail(l));
    if (better) resume.basics.name = titleCase(better.replace(/\.$/, ""));
  }
  if (/^(contact|contact details|details|personal details)$/i.test(resume.basics.name)) resume.basics.name = "";

  resume.basics.summary = summary.join(" ").replace(/\s+/g, " ").trim() || undefined;
  resume.skills = skillGroups
    .filter((g) => g.words.length)
    .map((g) => ({ id: newId("skill"), name: g.name, keywords: [...new Set(g.words)] }));
  resume.custom = resume.custom.filter((c) => c.items.length || c.text);
  for (const w of resume.work) if (!w.position && w.name) [w.position, w.name] = [w.name, ""];
  return resume;
}

function addWorkLine(work: Work[], content: string, isBullet: boolean, state: { dateFirst: boolean }) {
  const last = work[work.length - 1];
  const dateOnly = DATE_RANGE.test(content) && content.replace(DATE_RANGE, "").replace(/\([^)]*\)/g, "").replace(/[|,–-]/g, "").trim().length < 3;
  // a date line starts a role in date-first layouts ("Jan 2022 - Present", then company, then title)
  if (dateOnly) {
    const [startDate, endDate] = dates(content);
    if (last && !last.startDate && last.highlights.length === 0) Object.assign(last, { startDate, endDate });
    else {
      work.push({ id: newId("work"), name: "", position: "", startDate, endDate, highlights: [] });
      state.dateFirst = true;
    }
    return;
  }
  // in date-first layouts every role opens with a date line, so a short line after bullets is another bullet
  if (state.dateFirst && last && last.highlights.length > 0) {
    last.highlights.push(content);
    return;
  }
  // DOCX/PDF text often loses bullet glyphs: a sentence-like line is a highlight
  const sentenceLike = content.length > 70 || (/[.!]$/.test(content) && !DATE_RANGE.test(content) && content.split(" ").length >= 5);
  if (last && (isBullet || sentenceLike)) {
    last.highlights.push(content);
    return;
  }
  if (!last && (isBullet || sentenceLike)) {
    work.push({ id: newId("work"), name: "", position: "", highlights: [content] });
    return;
  }
  // a header line of the current role: fill company and title before any bullets
  if (last && last.highlights.length === 0 && (!last.position || !last.name)) {
    const { company, clients, rest } = splitCompany(content.replace(DATE_RANGE, "").trim());
    if (DATE_RANGE.test(content) && !last.startDate) [last.startDate, last.endDate] = dates(content);
    if (company && !last.name) {
      last.name = company;
      if (clients) last.summary = `Clients: ${clients}`;
      if (rest && !last.position) last.position = rest;
    } else if (!last.position) last.position = rest || content;
    else if (!last.name) last.name = rest || content;
    return;
  }
  // classic layout: "Title at Company   Jan 2020 – Present" on one line
  const [position, name] = splitRole(content.replace(DATE_RANGE, "").trim());
  const [startDate, endDate] = DATE_RANGE.test(content) ? dates(content) : [undefined, undefined];
  work.push({ id: newId("work"), position, name, startDate, endDate, highlights: [] });
}

/** "EPAM Systems | Clients - LSEG, Expedia" → company "EPAM Systems", clients "LSEG, Expedia". */
function splitCompany(s: string): { company?: string; clients?: string; rest?: string } {
  const m = s.match(/^(.+?)\s*\|\s*clients?\s*[-–:]\s*(.+)$/i);
  if (m) return { company: m[1]!.trim(), clients: m[2]!.trim() };
  if (COMPANY_HINT.test(s) && !/\b(engineer|manager|consultant|developer|analyst|lead|specialist|officer|director|architect)\b/i.test(s)) {
    return { company: s.replace(/\s*\|\s*$/, "").trim() };
  }
  return { rest: s };
}

function addEducationLine(resume: Resume, content: string) {
  const list = resume.education;
  let last = list[list.length - 1];
  const yearOnly = content.match(DATE)?.[0];
  const clean = content.replace(DATE_RANGE, "").replace(DATE, "").replace(/[|,–-]\s*$/, "").trim();
  const range = DATE_RANGE.test(content) ? dates(content) : undefined;
  const isDegree = DEGREE.test(clean) && clean.length < 80;
  const isInstitution = INSTITUTION.test(clean);
  if (!last || (isDegree && last.studyType) || (isInstitution && last.institution && !isDegree)) {
    list.push({ id: newId("edu"), institution: "" });
    last = list[list.length - 1]!;
  }
  if (range) [last.startDate, last.endDate] = range;
  else if (yearOnly && !last.endDate) last.endDate = yearOnly;
  if (!clean) return;
  if (isDegree && !last.studyType) {
    // "BSc Statistics" carries the field too
    const field = clean.replace(DEGREE, "").replace(/^[\s,.-]*(in|of)?\s*/i, "").trim();
    last.studyType = clean.match(DEGREE)![0];
    if (field) last.area = field;
  } else if (isInstitution && !last.institution) last.institution = clean;
  else if (!last.area && !last.institution) last.area = clean;
  else if (!last.institution && !/^(issued|evaluated|accredited|awarded)/i.test(clean)) last.institution = clean;
  else last.note = [last.note, clean].filter(Boolean).join(" · ");
}

function dates(s: string): [string | undefined, string | undefined] {
  const m = s.match(DATE_RANGE);
  if (!m) return [undefined, undefined];
  const parts = m[0].split(/\s*(?:[-–—]|\bto\b)\s*/i);
  return [cap(parts[0]?.trim()), cap(parts[parts.length - 1]?.trim())];
}

const cap = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function splitRole(s: string): [string, string] {
  const at = s.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
  if (at) return [at[1]!.trim(), at[2]!.trim()];
  const parts = s.split(/\s*[|–—,]\s*|\s+-\s+/).filter(Boolean);
  return [parts[0] ?? s, parts.slice(1).join(", ")];
}
