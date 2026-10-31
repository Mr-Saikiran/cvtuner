import { dedupeJobs, parseSearch, relevantTo, searchUrl, titleKeywords, type FoundJob, type SearchQuery, type SearchSource } from "@cvtuner/core";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

interface Keys {
  adzunaId?: string;
  adzunaKey?: string;
  rapidApiKey?: string;
}

/**
 * Searches job APIs that allow it, in parallel:
 * Remotive and Jobicy (free, remote roles), Adzuna (free key, local roles in 16 countries)
 * and JSearch on RapidAPI (free key; Google for Jobs, which includes LinkedIn, Indeed and Naukri listings).
 * Keys come from the user for this request only and are not stored.
 */
export async function POST(req: Request) {
  const body = ((await req.json().catch(() => null)) ?? {}) as { query?: SearchQuery; keys?: Keys };
  const q = body.query;
  if (!q?.title?.trim()) return NextResponse.json({ error: "Add a job title to search for." }, { status: 400 });
  const query: SearchQuery = { title: q.title.trim().slice(0, 100), location: (q.location ?? "").trim().slice(0, 80), country: /^[a-z]{2}$/.test(q.country ?? "") ? q.country : "in" };
  const keys = body.keys ?? {};

  const sources: SearchSource[] = ["remotive", "jobicy"];
  if (keys.adzunaId && keys.adzunaKey) sources.push("adzuna");
  if (keys.rapidApiKey) sources.push("jsearch");

  const fetchSource = async (source: SearchSource, q: SearchQuery) => {
        const res = await fetch(searchUrl(source, q, keys), {
          headers:
            source === "jsearch"
              ? { "X-RapidAPI-Key": keys.rapidApiKey!, "X-RapidAPI-Host": "jsearch.p.rapidapi.com" }
              : { Accept: "application/json", "User-Agent": "CVTunerBot/1.0 (+https://techswitch.in/cvtuner)" },
          signal: AbortSignal.timeout(20_000),
        });
        return res;
  };

  const results = await Promise.all(
    sources.map(async (source) => {
      try {
        let res = await fetchSource(source, query);
        // Jobicy matches tags, not phrases: retry with the title's key word ("procurement")
        if (source === "jobicy" && res.ok) {
          const first = (await res.clone().json().catch(() => ({}))) as { jobs?: unknown[] };
          const key = titleKeywords(query.title).sort((a, b) => b.length - a.length)[0];
          if (!first.jobs?.length && key && key !== query.title.toLowerCase()) res = await fetchSource(source, { ...query, title: key });
        }
        if (res.status === 401 || res.status === 403) return { source, jobs: [] as FoundJob[], error: "key rejected" };
        if (res.status === 429) return { source, jobs: [] as FoundJob[], error: "rate limited" };
        if (!res.ok) return { source, jobs: [] as FoundJob[], error: `error ${res.status}` };
        // free-text search on some boards is loose, so drop postings that never mention the role
        const jobs = parseSearch(source, await res.json())
          .filter((j) => relevantTo(j, query.title))
          .map((j) => ({ ...j, text: j.text.slice(0, 8000) }));
        return { source, jobs };
      } catch (e) {
        return { source, jobs: [] as FoundJob[], error: (e as Error).name === "TimeoutError" ? "timed out" : "unreachable" };
      }
    }),
  );

  // local and broad sources first, then remote boards
  const order: SearchSource[] = ["jsearch", "adzuna", "jobicy", "remotive"];
  const jobs = dedupeJobs(results.sort((a, b) => order.indexOf(a.source) - order.indexOf(b.source)).flatMap((r) => r.jobs)).slice(0, 200);
  return NextResponse.json({ query, jobs, sources: results.map((r) => ({ source: r.source, count: r.jobs.length, error: r.error })) });
}
