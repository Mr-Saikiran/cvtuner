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
