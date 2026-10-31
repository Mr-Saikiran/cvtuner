import { htmlToText, decodeEntities, type JobPosting } from "./jobsource";
import { allSkills, type Resume } from "./schema";

export type SearchSource = "remotive" | "jobicy" | "adzuna" | "jsearch";

export interface SearchQuery {
  /** role title, e.g. "Procurement Manager" */
  title: string;
  /** city or region, e.g. "Hyderabad" */
  location: string;
  /** ISO country code for country-specific sources */
  country: string;
}

export interface FoundJob extends JobPosting {
  /** where the listing came from, shown as credit ("via Jobicy", "LinkedIn via JSearch") */
  via: string;
  postedAt?: string;
}

const COUNTRY_HINTS: [RegExp, string][] = [
  [/india|hyderabad|bengaluru|bangalore|mumbai|pune|chennai|delhi|gurgaon|gurugram|noida|kolkata|ahmedabad/i, "in"],
  [/united kingdom|\buk\b|london|manchester|england|scotland/i, "gb"],
  [/united states|\busa\b|\bus\b|new york|san francisco|seattle|austin|boston|chicago|california|texas/i, "us"],
  [/canada|toronto|vancouver|montreal/i, "ca"],
  [/australia|sydney|melbourne/i, "au"],
  [/germany|berlin|munich|hamburg/i, "de"],
  [/singapore/i, "sg"],
  [/netherlands|amsterdam/i, "nl"],
  [/france|paris/i, "fr"],
  [/uae|dubai|abu dhabi/i, "ae"],
];

/** Builds a search from the profile: the headline or latest job title, the city, and the country. */
export function profileSearchQuery(resume: Resume): SearchQuery {
  // a compound headline ("Operations & Procurement Manager") searches badly; the latest job title is cleaner
  const label = resume.basics.label?.trim() ?? "";
  const compound = /[|,/&]|\band\b/i.test(label);
  const title = (compound || !label ? resume.work[0]?.position || label.split(/\s*[|,/&]\s*|\s+and\s+/i).pop() || allSkills(resume)[0] || "" : label).trim();
  const location = (resume.basics.location || resume.work[0]?.location || "").split(",")[0]!.trim();
  const where = [resume.basics.location, resume.work[0]?.location, resume.basics.phone?.startsWith("+91") ? "India" : ""].join(" ");
  const country = COUNTRY_HINTS.find(([re]) => re.test(where))?.[1] ?? "in";
  return { title, location, country };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const INDEED_HOST: Record<string, string> = { in: "in.indeed.com", gb: "uk.indeed.com", us: "www.indeed.com", ca: "ca.indeed.com", au: "au.indeed.com", de: "de.indeed.com", sg: "sg.indeed.com", nl: "nl.indeed.com", fr: "fr.indeed.com", ae: "ae.indeed.com" };

/**
 * Pre-filled searches on portals that don't allow automated access. The user opens them,
 * and sends a posting back with the share button or the browser extension.
 */
export function portalSearchLinks(q: SearchQuery): { name: string; url: string }[] {
  const e = encodeURIComponent;
  const links = [
    { name: "LinkedIn", url: `https://www.linkedin.com/jobs/search/?keywords=${e(q.title)}${q.location ? `&location=${e(q.location)}` : ""}` },
    { name: "Indeed", url: `https://${INDEED_HOST[q.country] ?? "www.indeed.com"}/jobs?q=${e(q.title)}${q.location ? `&l=${e(q.location)}` : ""}` },
    { name: "Google Jobs", url: `https://www.google.com/search?q=${e(`${q.title} jobs ${q.location}`.trim())}&ibp=htl;jobs` },
  ];
  if (q.country === "in") {
    links.splice(1, 0, { name: "Naukri", url: `https://www.naukri.com/${slug(q.title)}-jobs${q.location ? `-in-${slug(q.location)}` : ""}` });
  }
  return links;
}

/** Search API URLs. Keys are passed separately (headers or query) by the server route. */
export function searchUrl(source: SearchSource, q: SearchQuery, keys: { adzunaId?: string; adzunaKey?: string } = {}): string {
  const e = encodeURIComponent;
  switch (source) {
    case "remotive":
      return `https://remotive.com/api/remote-jobs?search=${e(q.title)}&limit=50`;
    case "jobicy":
      return `https://jobicy.com/api/v2/remote-jobs?count=50&tag=${e(q.title)}`;
    case "adzuna":
      return `https://api.adzuna.com/v1/api/jobs/${e(q.country)}/search/1?app_id=${e(keys.adzunaId ?? "")}&app_key=${e(keys.adzunaKey ?? "")}&results_per_page=50&what=${e(q.title)}${q.location ? `&where=${e(q.location)}` : ""}&content-type=application/json`;
    case "jsearch":
      return `https://jsearch.p.rapidapi.com/search?query=${e(`${q.title}${q.location ? ` in ${q.location}` : ""}`)}&page=1&num_pages=2&country=${e(q.country)}&date_posted=month`;
  }
}

interface AnyObj {
  [k: string]: unknown;
}
const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export function parseSearch(source: SearchSource, json: unknown): FoundJob[] {
  const j = (json ?? {}) as AnyObj;
  const list = (k: string) => (Array.isArray(j[k]) ? (j[k] as AnyObj[]) : []);
  switch (source) {
    case "remotive":
      return list("jobs").map((r) => ({
        id: `remotive-${r.id}`,
        title: str(r.title),
        company: str(r.company_name),
        location: [str(r.candidate_required_location), "Remote"].filter(Boolean).join(" · "),
        url: str(r.url) ?? "",
        text: [str(r.title), htmlToText(str(r.description) ?? "")].filter(Boolean).join("\n\n"),
        source: "page",
        via: "Remotive",
        postedAt: str(r.publication_date),
      }));
    case "jobicy":
      return list("jobs").map((r) => ({
        id: `jobicy-${r.id}`,
        title: decodeEntities(str(r.jobTitle) ?? ""),
        company: str(r.companyName),
        location: [str(r.jobGeo), "Remote"].filter(Boolean).join(" · "),
        url: str(r.url) ?? "",
        text: [str(r.jobTitle), htmlToText(str(r.jobDescription) ?? str(r.jobExcerpt) ?? "")].filter(Boolean).join("\n\n"),
        source: "page",
        via: "Jobicy",
        postedAt: str(r.pubDate),
      }));
    case "adzuna":
      return list("results").map((r) => ({
        id: `adzuna-${r.id}`,
        title: htmlToText(str(r.title) ?? ""),
        company: str((r.company as AnyObj | undefined)?.display_name),
        location: str((r.location as AnyObj | undefined)?.display_name),
        url: str(r.redirect_url) ?? "",
        // Adzuna returns a snippet; the full text is on the linked page
        text: [htmlToText(str(r.title) ?? ""), htmlToText(str(r.description) ?? "")].join("\n\n"),
        source: "page",
        via: "Adzuna",
        postedAt: str(r.created),
      }));
    case "jsearch":
      return list("data").map((r) => {
        const publisher = str(r.job_publisher);
        return {
          id: `jsearch-${r.job_id}`,
          title: str(r.job_title),
          company: str(r.employer_name),
          location: [str(r.job_city), str(r.job_state), str(r.job_country)].filter(Boolean).join(", ") || (r.job_is_remote ? "Remote" : undefined),
          url: str(r.job_apply_link) ?? str(r.job_google_link) ?? "",
          text: [str(r.job_title), str(r.job_description)].filter(Boolean).join("\n\n"),
          source: "page",
          via: publisher ? `${publisher} via JSearch` : "JSearch",
          postedAt: str(r.job_posted_at_datetime_utc),
        };
      });
  }
}

/** Drops repeats of the same role at the same company that several sources return. */
export function dedupeJobs(jobs: FoundJob[]): FoundJob[] {
  const seen = new Set<string>();
  return jobs.filter((j) => {
    const k = `${(j.title ?? "").toLowerCase().replace(/\W+/g, "")}|${(j.company ?? "").toLowerCase().replace(/\W+/g, "")}`;
    if (!j.url || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const GENERIC = new Set("senior sr junior jr lead head principal staff associate assistant executive manager management officer specialist engineer developer analyst consultant intern trainee director coordinator team member".split(" "));

/** The words of a title that carry the meaning: "Senior Procurement Manager" → ["procurement"]. */
export function titleKeywords(title: string): string[] {
  const words = title.toLowerCase().split(/[^a-z0-9+#.]+/).filter((w) => w.length > 1);
  const specific = words.filter((w) => !GENERIC.has(w));
  return specific.length ? specific : words;
}

/** Keeps postings whose title or opening text mentions what the person actually does. */
export function relevantTo(job: FoundJob, title: string): boolean {
  const keys = titleKeywords(title);
  if (!keys.length) return true;
  const hay = `${job.title ?? ""} ${job.text.slice(0, 1500)}`.toLowerCase();
  return keys.some((k) => hay.includes(k.length > 5 ? k.slice(0, -1) : k));
}
