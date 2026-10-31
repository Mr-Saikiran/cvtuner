"use client";

import { matchScore, portalSearchLinks, profileSearchQuery, type Resume, type SearchQuery } from "@cvtuner/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { INCOMING_KEY, useSearchRun, type SearchRun, type Settings } from "@/lib/store";
import { Button, Card } from "./ui";

const STALE_MS = 6 * 60 * 60 * 1000;
const COUNTRIES: [string, string][] = [
  ["in", "India"], ["us", "United States"], ["gb", "United Kingdom"], ["ca", "Canada"], ["au", "Australia"],
  ["de", "Germany"], ["sg", "Singapore"], ["nl", "Netherlands"], ["fr", "France"], ["ae", "UAE"],
];
const SOURCE_NAME: Record<string, string> = { remotive: "Remotive", jobicy: "Jobicy", adzuna: "Adzuna", jsearch: "JSearch (LinkedIn, Indeed, Naukri…)" };

/**
 * Finds jobs from the profile. Runs on its own when the tab opens, you are online and the
 * last search is old or was for a different title. Portals that forbid automated access
 * (LinkedIn, Naukri, Indeed) open as pre-filled searches instead.
 */
export function JobSearch({ profile, settings, onTune, onOpenSettings }: { profile: Resume; settings: Settings; onTune: () => void; onOpenSettings: () => void }) {
  const fromProfile = useMemo(() => profileSearchQuery(profile), [profile]);
  const [run, setRun] = useSearchRun();
  const [q, setQ] = useState<SearchQuery>(fromProfile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [minScore, setMinScore] = useState(0);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const search = useCallback(
    async (query: SearchQuery) => {
      if (!query.title.trim()) return;
      setBusy(true);
      setError(null);
      try {
        const { search: k } = settings;
        const res = await fetch("/cvtuner/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, keys: { adzunaId: k.adzunaId, adzunaKey: k.adzunaKey, rapidApiKey: k.rapidApiKey } }),
        });
        const data = (await res.json()) as Omit<SearchRun, "ranAt" | "jobs"> & { jobs?: SearchRun["jobs"]; error?: string };
        if (!res.ok) throw new Error(data.error ?? `Search failed (${res.status})`);
        const jobs = (data.jobs ?? []).map((j) => ({ ...j, ...matchScore(profile, j.text) })).sort((a, b) => b.score - a.score);
        setRun({ query: data.query, ranAt: Date.now(), jobs, sources: data.sources });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [profile, settings, setRun],
  );

  // automatic search: once per visit, when online, and only if the last run is stale or for another title
  const auto = useRef(false);
  useEffect(() => {
    if (auto.current || !settings.search.auto || !online || !fromProfile.title) return;
    auto.current = true;
    const stale = !run || Date.now() - run.ranAt > STALE_MS || run.query.title !== fromProfile.title;
    if (stale) {
      setQ(fromProfile);
      void search(fromProfile);
    } else setQ(run.query);
  }, [online, fromProfile, run, search, settings.search.auto]);

  const portals = portalSearchLinks(q);
  const shown = (run?.jobs ?? []).filter((j) => j.score >= minScore);
  const hasKeys = !!settings.search.rapidApiKey || !!(settings.search.adzunaId && settings.search.adzunaKey);

  const tune = (text: string, url: string, title?: string) => {
    try {
      localStorage.setItem(INCOMING_KEY, JSON.stringify({ text, url, title }));
    } catch {
      // storage blocked
    }
    onTune();
  };

  if (!fromProfile.title) {
    return (
      <Card title="Find jobs">
        <p className="text-muted text-sm">Add your headline or a job title in Profile, and CVTuner searches for matching jobs on its own.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card title="Find jobs for your profile" actions={!online ? <span className="text-warn text-xs">offline</span> : run ? <span className="code text-muted">{new Date(run.ranAt).toLocaleString()}</span> : null}>
        <form
          className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void search(q);
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="field-label">Job title</span>
            <input className="field" value={q.title} onChange={(e) => setQ({ ...q, title: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">City</span>
            <input className="field" value={q.location} onChange={(e) => setQ({ ...q, location: e.target.value })} placeholder="any" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="field-label">Country</span>
            <select className="field" value={q.country} onChange={(e) => setQ({ ...q, country: e.target.value })}>
              {COUNTRIES.map(([c, n]) => (
                <option key={c} value={c}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="primary" disabled={busy || !online || !q.title.trim()} aria-busy={busy}>
            {busy ? "Searching…" : "Search"}
          </Button>
        </form>

        <div className="border-rule mt-4 border-t pt-4">
          <p className="text-muted mb-2 text-xs">
            Also search on these sites. They don&apos;t allow apps to read their listings, so they open in a new tab. Send a job back with “Share → CVTuner” or the browser extension.
          </p>
          <div className="flex flex-wrap gap-2">
            {portals.map((p) => (
              <a key={p.name} href={p.url} target="_blank" rel="noreferrer" className="btn">
                {p.name} ↗
              </a>
            ))}
          </div>
        </div>

        {run?.sources.length ? (
          <p className="text-muted border-rule mt-4 border-t pt-3 text-xs">
            Searched{" "}
            {run.sources.map((s, i) => (
              <span key={s.source}>
                {i ? ", " : ""}
                {SOURCE_NAME[s.source] ?? s.source} <span className="code">{s.count}</span>
                {s.error ? <span className="text-warn"> ({s.error})</span> : null}
              </span>
            ))}
            .{" "}
            {!hasKeys ? (
              <button type="button" className="underline" onClick={onOpenSettings}>
                Add a free JSearch or Adzuna key for LinkedIn, Indeed, Naukri and local jobs.
              </button>
            ) : null}
          </p>
        ) : null}
        {error ? (
          <p className="bg-warn-soft border-warn mt-3 border-l-2 px-3 py-2 text-sm" role="alert">
            {error}
          </p>
        ) : null}
      </Card>

      <Card
        title={
          <span>
            Matching jobs <span className="code text-muted">{shown.length}</span>
          </span>
        }
        actions={
          <label className="text-muted flex items-center gap-2 text-xs whitespace-nowrap">
            Min match
            <select className="field w-auto py-1 text-xs" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))}>
              {[0, 30, 50, 70].map((n) => (
                <option key={n} value={n}>
                  {n}%
                </option>
              ))}
            </select>
          </label>
        }
      >
        {busy && !run ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-12 w-full" />
            ))}
          </div>
        ) : !shown.length ? (
          <p className="text-muted text-sm">{run ? "No jobs found. Try a broader title, or another city." : online ? "Searching starts when you open this tab." : "You're offline. Search runs when you're back online."}</p>
        ) : (
          <table className="spec spec--stack text-sm">
            <thead>
              <tr>
                <th scope="col">Role</th>
                <th scope="col">Where</th>
                <th scope="col">Match</th>
                <th scope="col">Source</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, 120).map((j) => (
                <tr key={j.id ?? j.url}>
                  <td data-label="">
                    <p className="font-medium">{j.title}</p>
                    <p className="text-muted text-xs">
                      {j.company}
                      {j.missing.length ? ` · missing ${j.missing.slice(0, 3).join(", ")}` : ""}
                    </p>
                  </td>
                  <td data-label="Where" className="text-muted text-xs">
                    {j.location ?? "not stated"}
                  </td>
                  <td data-label="Match">
                    <span className={`code ${j.score >= 70 ? "" : j.score >= 45 ? "text-ink-2" : "text-warn"}`}>{j.score}%</span>
                  </td>
                  <td data-label="Source" className="text-muted text-xs">
                    <a href={j.url} target="_blank" rel="noreferrer">
                      {j.via} ↗
                    </a>
                  </td>
                  <td data-label="">
                    <span className="flex justify-end">
                      <Button onClick={() => tune(j.text, j.url, j.title)}>Tune</Button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
