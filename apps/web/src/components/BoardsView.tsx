"use client";

import { detectAts, matchScore, newId, type Resume } from "@cvtuner/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchJob } from "@/lib/ai";
import { INCOMING_KEY, useBoards, type WatchedBoard } from "@/lib/store";
import { Badge, Button, Card } from "./ui";

const AUTO_CHECK_MS = 6 * 60 * 60 * 1000;

/** Company job boards to watch. New postings are scored against the profile so the best matches float up. */
export function BoardsView({ profile, onTune }: { profile: Resume; onTune: () => void }) {
  const [boards, setBoards] = useBoards();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [minScore, setMinScore] = useState(0);
  // read after mount so server and client render the same markup
  const [canAskNotify, setCanAskNotify] = useState(false);
  useEffect(() => setCanAskNotify(typeof Notification !== "undefined" && Notification.permission === "default"), []);

  const check = useCallback(
    async (board: WatchedBoard): Promise<WatchedBoard> => {
      try {
        const { jobs = [] } = await fetchJob(board.url, "board");
        const seen = new Set(board.seen);
        const firstRun = board.seen.length === 0;
        const scored = jobs.map((j) => {
          const { score, missing } = matchScore(profile, j.text);
          return { ...j, score, missing, isNew: !firstRun && !seen.has(j.id ?? j.url) };
        });
        return { ...board, jobs: scored, seen: scored.map((j) => j.id ?? j.url), lastChecked: Date.now(), error: undefined, name: board.name || scored[0]?.company || board.name };
      } catch (e) {
        return { ...board, error: (e as Error).message, lastChecked: Date.now() };
      }
    },
    [profile],
  );

  const checkAll = useCallback(
    async (list: WatchedBoard[], notify = false) => {
      setBusy("all");
      const updated: WatchedBoard[] = [];
      for (const b of list) updated.push(await check(b));
      setBoards(updated);
      setBusy(null);
      const fresh = updated.flatMap((b) => b.jobs.filter((j) => j.isNew && j.score >= 60));
      if (notify && fresh.length && typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(`CVTuner: ${fresh.length} new matching job${fresh.length > 1 ? "s" : ""}`, { body: fresh.slice(0, 3).map((j) => `${j.title} (${j.score}%)`).join("\n"), icon: "/cvtuner/icon.svg" });
      }
    },
    [check, setBoards],
  );

  // check automatically when the tab opens and the last check is old
  const auto = useRef(false);
  useEffect(() => {
    if (auto.current || !boards.length) return;
    auto.current = true;
    if (boards.some((b) => !b.lastChecked || Date.now() - b.lastChecked > AUTO_CHECK_MS)) void checkAll(boards, true);
  }, [boards, checkAll]);

  const add = async () => {
    setError(null);
    const ats = detectAts(url.trim());
    if (!ats) {
      setError("Paste a careers page link from Greenhouse, Lever, Ashby, SmartRecruiters or Workable, e.g. https://boards.greenhouse.io/acme or https://jobs.lever.co/acme");
      return;
    }
    const name = "board" in ats ? ats.board : "company" in ats ? ats.company : "org" in ats ? ats.org : ats.account;
    if (boards.some((b) => detectAts(b.url)?.kind === ats.kind && b.name.toLowerCase() === name.toLowerCase())) {
      setError("You already watch this board.");
      return;
    }
    const board: WatchedBoard = { id: newId("board"), url: url.trim(), name, seen: [], jobs: [] };
    setBusy(board.id);
    const checked = await check(board);
    setBusy(null);
    if (checked.error) {
      setError(checked.error);
      return;
    }
    setBoards((prev) => [...prev, checked]);
    setUrl("");
  };

  const all = useMemo(
    () =>
      boards
        .flatMap((b) => b.jobs.map((j) => ({ ...j, board: b.name })))
        .filter((j) => j.score >= minScore)
        .filter((j) => !query || `${j.title} ${j.location} ${j.board}`.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => Number(b.isNew) - Number(a.isNew) || b.score - a.score),
    [boards, query, minScore],
  );

  const tune = (text: string, jobUrl: string, title?: string) => {
    try {
      localStorage.setItem(INCOMING_KEY, JSON.stringify({ text, url: jobUrl, title }));
    } catch {
      // storage blocked — nothing to hand over
    }
    onTune();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <Card title="Watch company job boards">
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <input className="field" type="url" placeholder="https://boards.greenhouse.io/company" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Job board link" />
            <Button type="submit" variant="primary" disabled={!url.trim() || !!busy}>
              {busy && busy !== "all" ? "Checking…" : "Watch board"}
            </Button>
          </form>
          {error ? <p className="mt-2 text-sm text-warn">{error}</p> : null}
          <p className="text-muted mt-3 text-xs">
            Works with Greenhouse, Lever, Ashby, SmartRecruiters and Workable boards. Boards are checked when you open this tab (every 6 hours at most), and every posting
            is scored against your profile.
          </p>
          {canAskNotify ? (
            <Button variant="ghost" className="mt-2" onClick={() => void Notification.requestPermission().then(() => setCanAskNotify(false))}>
              Notify me about new matches
            </Button>
          ) : null}
        </Card>

        {boards.length ? (
          <Card title="Watching" actions={<Button onClick={() => void checkAll(boards)} disabled={!!busy}>{busy === "all" ? "Checking…" : "Check now"}</Button>}>
            <ul className="flex flex-col gap-2">
              {boards.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium capitalize">{b.name}</p>
                    <p className={`truncate text-xs ${b.error ? "text-warn" : "text-muted"}`}>
                      {b.error ?? `${b.jobs.length} open · ${b.lastChecked ? new Date(b.lastChecked).toLocaleString() : "never checked"}`}
                    </p>
                  </div>
                  <Button variant="danger" onClick={() => setBoards((prev) => prev.filter((x) => x.id !== b.id))} aria-label={`Stop watching ${b.name}`}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      <Card
        title={`Open roles${all.length ? ` (${all.length})` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input className="field w-40 py-1.5 text-sm" placeholder="Filter title, city" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Filter roles" />
            <label className="text-muted flex items-center gap-1 text-xs">
              Min match
              <select className="field w-auto py-1 text-xs" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))}>
                {[0, 30, 50, 70].map((n) => (
                  <option key={n} value={n}>
                    {n}%
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
      >
        {!all.length ? (
          <p className="text-muted text-sm">{boards.length ? "No roles match the filters." : "Add a company board to see its open roles ranked by how well they match your profile."}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-rule">
            {all.slice(0, 150).map((j) => (
              <li key={`${j.board}-${j.id ?? j.url}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium">
                    <span className="truncate">{j.title}</span>
                    {j.isNew ? <Badge tone="brand">New</Badge> : null}
                  </p>
                  <p className="text-muted truncate text-xs capitalize">
                    {j.board}
                    {j.location ? ` · ${j.location}` : ""}
                    {j.missing.length ? ` · missing ${j.missing.slice(0, 3).join(", ")}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={j.score >= 70 ? "good" : j.score >= 45 ? "warn" : "bad"}>{j.score}%</Badge>
                  <a href={j.url} target="_blank" rel="noreferrer" className="text-muted text-xs hover:underline">
                    View ↗
                  </a>
                  <Button variant="primary" onClick={() => tune(j.text, j.url, j.title)}>
                    Tune
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
