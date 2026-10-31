import { atsApiUrl, detectAts, isBlockedHost, pageText, parseAts, parseJsonLd, type JobPosting } from "@cvtuner/core";
import { NextResponse } from "next/server";
import { FetchError, safeFetch } from "@/lib/server/safeFetch";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BOARD_JOBS = 300;

/**
 * POST { url, mode: "job" | "board" }
 * job:   one posting from an ATS API, the page's JSON-LD, or its readable text.
 * board: every open posting on a Greenhouse / Lever / Ashby / SmartRecruiters / Workable board.
 */
export async function POST(req: Request) {
  const { url, mode = "job" } = ((await req.json().catch(() => ({}))) ?? {}) as { url?: string; mode?: "job" | "board" };
  if (!url) return NextResponse.json({ error: "Paste a job link." }, { status: 400 });
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return NextResponse.json({ error: "That doesn't look like a link." }, { status: 400 });
  }
  if (isBlockedHost(host)) {
    return NextResponse.json(
      {
        error: `${host.replace(/^www\./, "")} doesn't allow automated access. Open the job there, select the description and paste it, or use "Share → CVTuner" on your phone or the browser extension.`,
        blocked: true,
      },
      { status: 422 },
    );
  }

  try {
    const ats = detectAts(url);
    if (mode === "board") {
      if (!ats) return NextResponse.json({ error: "Watched boards work with Greenhouse, Lever, Ashby, SmartRecruiters and Workable links." }, { status: 400 });
      // whole boards with full descriptions can be large
      const res = await safeFetch(atsApiUrl({ ...ats, id: undefined }), "application/json", 25 * 1024 * 1024);
      if (res.status !== 200) return NextResponse.json({ error: `The job board answered ${res.status}. Check the company name in the link.` }, { status: 502 });
      const jobs = parseAts({ ...ats, id: undefined }, JSON.parse(res.body), url).slice(0, MAX_BOARD_JOBS).map((j) => ({ ...j, text: j.text.slice(0, 8000) }));
      return NextResponse.json({ jobs, kind: ats.kind });
    }

    if (ats?.id) {
      // Ashby only offers a whole-board endpoint, so allow board-sized responses here too
      const res = await safeFetch(atsApiUrl(ats), "application/json", 25 * 1024 * 1024);
      if (res.status === 200) {
        const [job] = parseAts(ats, JSON.parse(res.body), url);
        if (job?.text) return NextResponse.json({ job: trim(job) });
      }
    }
    const page = await safeFetch(url);
    if (page.status >= 400) return NextResponse.json({ error: `The page answered ${page.status}. It may need a login — paste the description instead.` }, { status: 502 });
    const job = parseJsonLd(page.body, page.url) ?? pageText(page.body, page.url);
    if (job.text.length < 200) return NextResponse.json({ error: "Couldn't find a job description on that page. Paste it instead." }, { status: 422 });
    return NextResponse.json({ job: trim(job) });
  } catch (e) {
    const status = e instanceof FetchError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

function trim(j: JobPosting): JobPosting {
  return { ...j, text: j.text.slice(0, 20000) };
}
