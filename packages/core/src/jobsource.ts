/**
 * Pure helpers for turning job pages and ATS APIs into plain job text.
 * Network access lives in the web app (with SSRF protection); this file only parses.
 */

export interface JobPosting {
  title?: string;
  company?: string;
  location?: string;
  url: string;
  text: string;
  source: "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "workable" | "json-ld" | "page";
  id?: string;
}

export type AtsRef =
  | { kind: "greenhouse"; board: string; id?: string }
  | { kind: "lever"; company: string; id?: string }
  | { kind: "ashby"; org: string; id?: string }
  | { kind: "smartrecruiters"; company: string; id?: string }
  | { kind: "workable"; account: string; id?: string };

/** Sites whose terms forbid automated access. We ask the user to paste or use the share button instead. */
const BLOCKED = /(^|\.)(linkedin\.com|indeed\.[a-z.]+|naukri\.com|glassdoor\.[a-z.]+|monster\.[a-z.]+|foundit\.in|ziprecruiter\.com|instahyre\.com|shine\.com)$/i;

export function isBlockedHost(host: string): boolean {
  return BLOCKED.test(host);
}

export function detectAts(raw: string): AtsRef | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const parts = u.pathname.split("/").filter(Boolean);
  const host = u.hostname.toLowerCase();
  if (/(^|\.)greenhouse\.io$/.test(host) && parts[0]) {
    const i = parts.indexOf("jobs");
    return { kind: "greenhouse", board: parts[0], id: i >= 0 ? parts[i + 1] : (u.searchParams.get("gh_jid") ?? undefined) };
  }
  if (host === "jobs.lever.co" && parts[0]) return { kind: "lever", company: parts[0], id: parts[1] };
  if (host === "jobs.ashbyhq.com" && parts[0]) return { kind: "ashby", org: parts[0], id: parts[1] };
  if (/(^|\.)smartrecruiters\.com$/.test(host) && parts[0] && host !== "api.smartrecruiters.com") {
    return { kind: "smartrecruiters", company: parts[0], id: parts[1]?.split("-")[0] };
  }
  if (host === "apply.workable.com" && parts[0]) {
    const j = parts.indexOf("j");
    return { kind: "workable", account: parts[0], id: j >= 0 ? parts[j + 1] : undefined };
  }
  return null;
}

/** API URL for one posting (id present) or for the whole board (id absent). */
export function atsApiUrl(ref: AtsRef): string {
  switch (ref.kind) {
    case "greenhouse":
      return ref.id
        ? `https://boards-api.greenhouse.io/v1/boards/${enc(ref.board)}/jobs/${enc(ref.id)}`
        : `https://boards-api.greenhouse.io/v1/boards/${enc(ref.board)}/jobs?content=true`;
    case "lever":
      return ref.id ? `https://api.lever.co/v0/postings/${enc(ref.company)}/${enc(ref.id)}` : `https://api.lever.co/v0/postings/${enc(ref.company)}?mode=json`;
    case "ashby":
      return `https://api.ashbyhq.com/posting-api/job-board/${enc(ref.org)}`;
    case "smartrecruiters":
      return ref.id
        ? `https://api.smartrecruiters.com/v1/companies/${enc(ref.company)}/postings/${enc(ref.id)}`
        : `https://api.smartrecruiters.com/v1/companies/${enc(ref.company)}/postings?limit=100`;
    case "workable":
      return ref.id ? `https://apply.workable.com/api/v2/accounts/${enc(ref.account)}/jobs/${enc(ref.id)}` : `https://apply.workable.com/api/v3/accounts/${enc(ref.account)}/jobs`;
  }
}

const enc = encodeURIComponent;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…", bull: "•" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** HTML → readable text that keeps list items and headings on their own lines. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(/<\/(p|div|h[1-6]|li|ul|ol|section|article|tr)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface AnyObj {
  [k: string]: unknown;
}
const str = (v: unknown) => (typeof v === "string" ? v : undefined);

/** Finds a schema.org JobPosting in the page's JSON-LD blocks. */
export function parseJsonLd(html: string, url: string): JobPosting | null {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]!);
  for (const block of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(block.trim());
    } catch {
      continue;
    }
    const items: AnyObj[] = [];
    const walk = (x: unknown) => {
      if (Array.isArray(x)) x.forEach(walk);
      else if (x && typeof x === "object") {
        items.push(x as AnyObj);
        if ((x as AnyObj)["@graph"]) walk((x as AnyObj)["@graph"]);
      }
    };
    walk(data);
    const job = items.find((i) => [i["@type"]].flat().includes("JobPosting"));
    if (!job) continue;
    const org = job.hiringOrganization as AnyObj | undefined;
    const loc = [job.jobLocation].flat()[0] as AnyObj | undefined;
    const addr = loc?.address as AnyObj | undefined;
    const description = htmlToText(decodeEntities(str(job.description) ?? ""));
    const extra = ["qualifications", "responsibilities", "skills", "experienceRequirements"]
      .map((k) => str(job[k]))
      .filter(Boolean)
      .map((v) => htmlToText(v!));
    return {
      title: str(job.title),
      company: str(org?.name),
      location: [str(addr?.addressLocality), str(addr?.addressCountry)].filter(Boolean).join(", ") || undefined,
      url,
      text: [str(job.title), description, ...extra].filter(Boolean).join("\n\n"),
      source: "json-ld",
    };
  }
  return null;
}

/** Fallback: the main readable text of a page. */
export function pageText(html: string, url: string): JobPosting {
  const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html.match(/<body[\s\S]*?<\/body>/i)?.[0] ?? html;
  return { title: title || undefined, url, text: htmlToText(main).slice(0, 20000), source: "page" };
}

/** Normalises an ATS API response into postings (one for a job URL, many for a board). */
export function parseAts(ref: AtsRef, json: unknown, url: string): JobPosting[] {
  const j = json as AnyObj;
  switch (ref.kind) {
    case "greenhouse": {
      const list = (Array.isArray(j.jobs) ? j.jobs : [j]) as AnyObj[];
      return list.map((g) => ({
        id: String(g.id ?? ""),
        title: str(g.title),
        company: str(g.company_name),
        location: str((g.location as AnyObj | undefined)?.name),
        url: str(g.absolute_url) ?? url,
        text: [str(g.title), htmlToText(decodeEntities(str(g.content) ?? ""))].filter(Boolean).join("\n\n"),
        source: "greenhouse" as const,
      }));
    }
    case "lever": {
      const list = (Array.isArray(json) ? json : [j]) as AnyObj[];
      return list.map((l) => {
        const cats = (l.categories ?? {}) as AnyObj;
        const lists = ((l.lists ?? []) as AnyObj[]).map((x) => `${str(x.text) ?? ""}\n${htmlToText(str(x.content) ?? "")}`);
        return {
          id: str(l.id),
          title: str(l.text),
          company: ref.company,
          location: str(cats.location),
          url: str(l.hostedUrl) ?? url,
          text: [str(l.text), str(l.descriptionPlain) ?? htmlToText(str(l.description) ?? ""), ...lists, str(l.additionalPlain)].filter(Boolean).join("\n\n"),
          source: "lever" as const,
        };
      });
    }
    case "ashby": {
      const list = ((j.jobs ?? []) as AnyObj[]).filter((a) => !ref.id || a.id === ref.id);
      return list.map((a) => ({
        id: str(a.id),
        title: str(a.title),
        company: ref.org,
        location: str(a.location),
        url: str(a.jobUrl) ?? url,
        text: [str(a.title), str(a.descriptionPlain) ?? htmlToText(str(a.descriptionHtml) ?? "")].filter(Boolean).join("\n\n"),
        source: "ashby" as const,
      }));
    }
    case "smartrecruiters": {
      if (Array.isArray(j.content)) {
        return (j.content as AnyObj[]).map((s) => ({
          id: str(s.id),
          title: str(s.name),
          company: str((s.company as AnyObj | undefined)?.name),
          location: str((s.location as AnyObj | undefined)?.city),
          url: `https://jobs.smartrecruiters.com/${ref.company}/${str(s.id)}`,
          text: str(s.name) ?? "",
          source: "smartrecruiters" as const,
        }));
      }
      const sections = ((j.jobAd as AnyObj | undefined)?.sections ?? {}) as Record<string, AnyObj>;
      const text = Object.values(sections)
        .map((s) => [str(s.title), htmlToText(str(s.text) ?? "")].filter(Boolean).join("\n"))
        .join("\n\n");
      return [{ id: str(j.id), title: str(j.name), company: str((j.company as AnyObj | undefined)?.name), url, text: [str(j.name), text].filter(Boolean).join("\n\n"), source: "smartrecruiters" }];
    }
    case "workable": {
      const list = (Array.isArray(j.results) ? j.results : [j]) as AnyObj[];
      return list.map((w) => ({
        id: str(w.shortcode),
        title: str(w.title),
        company: ref.account,
        location: str((w.location as AnyObj | undefined)?.city),
        url: w.shortcode ? `https://apply.workable.com/${ref.account}/j/${str(w.shortcode)}/` : url,
        text: [str(w.title), htmlToText(str(w.description) ?? ""), htmlToText(str(w.requirements) ?? ""), htmlToText(str(w.benefits) ?? "")].filter(Boolean).join("\n\n"),
        source: "workable" as const,
      }));
    }
  }
}

/** Lines that are portal chrome, not part of a job description. */
const CHROME_LINE = /^(apply|easy apply|save|saved|share|show more|show less|see more|see less|report this job|report job|promoted|actively recruiting|reposted.*|\d+ (applicants?|clicks?).*|over \d+ applicants|be an early applicant|.*ago$|·.*|message|follow|following|premium|try premium.*|retry premium.*|get the app|sign in|join now|skip to main content|jobs|home|my network|messaging|notifications|me|for business|set alert.*|job alert.*|how you match.*|people you can reach out to|meet the hiring team|see how you compare.*|exclusive job seeker insights|top job picks.*|\d+ of \d+ skills match.*|show match details|tailor my resume|create cover letter|help me stand out|am i a good fit.*|beta|is this information helpful\?|yes|no)$/i;

/**
 * Cleans text copied from a whole job page (Ctrl+A, Ctrl+C) on LinkedIn, Naukri or Indeed:
 * keeps the description, drops navigation, buttons and recommendation panels.
 */
export function cleanCopiedJob(raw: string): { text: string; title?: string; company?: string; cleaned: boolean } {
  const text = raw.replace(/\r/g, "");
  const markers: [RegExp, RegExp][] = [
    // LinkedIn
    [/^\s*about the job\s*$/im, /^\s*(set alert for similar jobs|about the company|see how you compare|meet the hiring team|more jobs|people also viewed|show less|looking for talent\?)\s*$/im],
    // Indeed
    [/^\s*full job description\s*$/im, /^\s*(report job|hiring insights|job activity|if you require alternative methods)\b.*$/im],
    // Naukri
    [/^\s*job description\s*$/im, /^\s*(about company|beware of imposters|similar jobs|reviews|benefits & perks)\s*$/im],
  ];
  for (const [start, end] of markers) {
    const s = text.search(start);
    if (s === -1) continue;
    const head = text.slice(0, s);
    let body = text.slice(s).replace(start, "");
    const e = body.search(end);
    if (e > 40) body = body.slice(0, e);
    const lines = body.split("\n").map((l) => l.trim()).filter((l) => l && !CHROME_LINE.test(l));
    // on the page the company and title sit just above the "City · 3 weeks ago · 100 applicants" line
    const headLines = head.split("\n").map((l) => l.trim()).filter(Boolean);
    const meta = headLines.findIndex((l) => /\s·\s|\bago\b|applicants|posted/i.test(l));
    const above = (meta >= 0 ? headLines.slice(0, meta) : headLines).filter((l) => !CHROME_LINE.test(l) && l.length < 90);
    const title = above[above.length - 1];
    const company = above[above.length - 2];
    return {
      text: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
      title,
      company,
      cleaned: true,
    };
  }
  const lines = text.split("\n").map((l) => l.trim());
  return { text: lines.filter((l) => !CHROME_LINE.test(l)).join("\n").replace(/\n{3,}/g, "\n\n").trim(), cleaned: false };
}

/** Title and company from a portal URL slug, e.g. /jobs/view/senior-buyer-at-acme-4470449960 → "senior buyer", "acme". */
export function slugHints(url: string): { title?: string; company?: string } {
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean);
    const last = seg[seg.length - 1] ?? "";
    // LinkedIn: <title>-at-<company>-<id>; Naukri: job-listings-<title>-<company>-<city>-<years>-<id>; Indeed uses ?jk= only
    const m = last.match(/^(.+?)-at-(.+?)-\d{6,}$/);
    if (m) return { title: m[1]!.replace(/-/g, " "), company: m[2]!.replace(/-/g, " ") };
    const n = last.match(/^job-listings-(.+?)-\d{6,}$/);
    if (n) return { title: n[1]!.replace(/-\d+-to-\d+-years?$/, "").replace(/-/g, " ") };
    return {};
  } catch {
    return {};
  }
}
