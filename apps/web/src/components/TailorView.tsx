"use client";

import { applySuggestions, newId, SAMPLE_JD, tailor, type KeywordMatch, type Resume, type Suggestion } from "@cvtuner/core";
import { useEffect, useMemo, useState } from "react";
import { useDraftJd, type SavedJob, type Settings } from "@/lib/store";
import { JdHighlight } from "./JdHighlight";
import { Preview } from "./Preview";
import { Badge, Button, Card, ScoreRing, Segmented } from "./ui";

interface Props {
  profile: Resume;
  settings: Settings;
  setSettings: (s: Settings) => void;
  openJob: SavedJob | null;
  onSave: (job: SavedJob) => void;
}

/** Stable identity for a suggestion across re-runs, so user edits survive voice/skill changes. */
const keyOf = (s: Suggestion) => (s.kind === "add-bullet" ? `b:${s.source}` : s.kind);

type Override = { accepted?: boolean; text?: string };

export function TailorView({ profile, settings, setSettings, openJob, onSave }: Props) {
  const [draft, setDraft] = useDraftJd();
  const [analyzed, setAnalyzed] = useState<string>("");
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [jobId, setJobId] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "highlight">("edit");
  const [mobilePane, setMobilePane] = useState<"changes" | "preview">("changes");

  // opening a saved job restores its JD, confirmations and line-by-line choices
  useEffect(() => {
    if (!openJob) return;
    setDraft(openJob.jd);
    setAnalyzed(openJob.jd);
    setConfirmed(openJob.confirmedSkills);
    setOverrides(Object.fromEntries(openJob.suggestions.map((s) => [keyOf(s), { accepted: s.accepted, text: s.kind === "add-bullet" || s.kind === "summary" ? s.text : undefined }])));
    setJobId(openJob.id);
    setMode("highlight");
  }, [openJob, setDraft]);

  const result = useMemo(
    () => (analyzed.trim() ? tailor(profile, analyzed, { voice: settings.voice, confirmedSkills: confirmed }) : null),
    [analyzed, profile, settings.voice, confirmed],
  );

  const suggestions: Suggestion[] = useMemo(
    () =>
      (result?.suggestions ?? []).map((s) => {
        const o = overrides[keyOf(s)];
        if (!o) return s;
        const next = { ...s, accepted: o.accepted ?? s.accepted } as Suggestion;
        // a manual edit is kept only for the voice it was written in
        if (o.text && (next.kind === "add-bullet" || next.kind === "summary")) next.text = o.text;
        return next;
      }),
    [result, overrides],
  );

  const tuned = useMemo(() => applySuggestions(profile, suggestions), [profile, suggestions]);
  const protect = suggestions.flatMap((s) => (s.accepted && s.kind === "add-bullet" ? [s.text] : []));
  const keywords = result?.keywords.map((k) => k.name) ?? [];

  const analyze = () => {
    setAnalyzed(draft);
    setMode("highlight");
    if (draft !== openJob?.jd) setJobId(null);
  };

  const toggleConfirm = (k: KeywordMatch) =>
    setConfirmed((prev) => (prev.includes(k.name) ? prev.filter((x) => x !== k.name) : [...prev, k.name]));

  const setOverride = (s: Suggestion, o: Override) => setOverrides((prev) => ({ ...prev, [keyOf(s)]: { ...prev[keyOf(s)], ...o } }));

  const save = () => {
    if (!result) return;
    const now = Date.now();
    const id = jobId ?? newId("job");
    setJobId(id);
    onSave({
      id,
      title: result.jd.title ?? "Untitled role",
      company: result.jd.company,
      jd: analyzed,
      createdAt: openJob?.id === id ? openJob.createdAt : now,
      updatedAt: now,
      confirmedSkills: confirmed,
      suggestions,
      score: result.score,
    });
  };

  const covered = result?.keywords.filter((k) => k.coverage === "covered") ?? [];
  const missing = result?.keywords.filter((k) => k.coverage === "missing") ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <Card
          title="Job description"
          actions={
            <>
              {result ? (
                <Segmented
                  label="JD view"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "edit", label: "Edit" },
                    { value: "highlight", label: "Highlights" },
                  ]}
                />
              ) : null}
              {!draft ? (
                <Button variant="ghost" onClick={() => setDraft(SAMPLE_JD)}>
                  Try a sample
                </Button>
              ) : null}
            </>
          }
        >
          <div className="mb-3 flex gap-2">
            <input
              className="field"
              type="url"
              placeholder="Job link (LinkedIn, Naukri, Greenhouse…) — coming in Phase 2"
              disabled
              aria-label="Job link (coming soon)"
            />
          </div>
          {mode === "edit" || !result ? (
            <textarea
              className="field min-h-[260px] resize-y font-mono text-[13px] leading-relaxed lg:min-h-[340px]"
              placeholder="Paste the full job description here — responsibilities, requirements, nice-to-haves. Any field works: nursing, finance, sales, software…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Job description"
            />
          ) : (
            <JdHighlight text={analyzed} keywords={result.keywords} />
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="muted text-xs">{draft.trim() ? `${draft.trim().split(/\s+/).length} words` : "Nothing pasted yet"}</span>
            <div className="flex gap-2">
              {draft ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDraft("");
                    setAnalyzed("");
                    setConfirmed([]);
                    setOverrides({});
                    setJobId(null);
                    setMode("edit");
                  }}
                >
                  Clear
                </Button>
              ) : null}
              <Button variant="primary" onClick={analyze} disabled={!draft.trim()}>
                {analyzed && analyzed === draft ? "Re-tune" : "Tune my resume"}
              </Button>
            </div>
          </div>
        </Card>

        {result ? (
          <Card title="Match">
            <div className="flex flex-wrap items-center gap-6">
              <ScoreRing value={result.score} label={<>Keyword match<br />before tuning</>} />
              {result.projectedScore > result.score ? <ScoreRing value={result.projectedScore} label="After tuning" /> : null}
              <div className="min-w-0 flex-1 text-sm">
                {result.jd.title ? <p className="font-medium">{result.jd.title}</p> : null}
                {result.jd.company ? <p className="muted">{result.jd.company}</p> : null}
              </div>
            </div>
            {covered.length ? (
              <div className="mt-4">
                <p className="muted mb-1.5 text-xs font-medium uppercase tracking-wide">You have</p>
                <div className="flex flex-wrap gap-1.5">
                  {covered.map((k) => (
                    <Badge key={k.name} tone="good">{k.name}</Badge>
                  ))}
                </div>
              </div>
            ) : null}
            {missing.length ? (
              <div className="mt-4">
                <p className="muted mb-1.5 text-xs font-medium uppercase tracking-wide">Missing from your resume — tap the ones you really have</p>
                <div className="flex flex-wrap gap-1.5">
                  {missing.map((k) => (
                    <button
                      key={k.name}
                      type="button"
                      onClick={() => toggleConfirm(k)}
                      aria-pressed={k.confirmed}
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                        k.confirmed ? "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-400" : "border-red-500/40 text-red-700 hover:bg-red-500/10 dark:text-red-400"
                      }`}
                    >
                      {k.confirmed ? "✓ " : "+ "}
                      {k.name}
                    </button>
                  ))}
                </div>
                <p className="muted mt-2 text-xs">CVTuner never adds a skill you have not confirmed.</p>
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        {result ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  label="Sentence voice"
                  value={settings.voice}
                  onChange={(voice) => {
                    setSettings({ ...settings, voice });
                    // edited texts belong to the old voice — reset them, keep accept/reject choices
                    setOverrides((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { accepted: v.accepted }])));
                  }}
                  options={[
                    { value: "passive", label: "Passive voice" },
                    { value: "active", label: "Action verbs" },
                  ]}
                />
                <Segmented
                  label="Page limit"
                  value={settings.maxPages}
                  onChange={(maxPages) => setSettings({ ...settings, maxPages })}
                  options={[
                    { value: 2, label: "2 pages" },
                    { value: 3, label: "Up to 3" },
                  ]}
                />
              </div>
              <Button onClick={save}>{jobId ? "Update saved" : "Save version"}</Button>
            </div>

            <div className="lg:hidden">
              <Segmented
                label="Show"
                value={mobilePane}
                onChange={setMobilePane}
                options={[
                  { value: "changes", label: `Changes (${suggestions.filter((s) => s.accepted).length})` },
                  { value: "preview", label: "Preview & download" },
                ]}
              />
            </div>

            <div className={mobilePane === "changes" ? "" : "hidden lg:block"}>
              <Changes suggestions={suggestions} onChange={setOverride} />
            </div>
            <div className={mobilePane === "preview" ? "" : "hidden lg:block"}>
              <Preview resume={tuned} maxPages={settings.maxPages} keywords={keywords} protect={protect} title={result.jd.title} company={result.jd.company} />
            </div>
          </>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

function Changes({ suggestions, onChange }: { suggestions: Suggestion[]; onChange: (s: Suggestion, o: Override) => void }) {
  if (!suggestions.length) {
    return (
      <Card title="Changes">
        <p className="muted text-sm">
          No safe changes found. Add more detail to your profile, or confirm missing skills you actually have.
        </p>
      </Card>
    );
  }
  const bullets = suggestions.filter((s) => s.kind === "add-bullet");
  const other = suggestions.filter((s) => s.kind !== "add-bullet");
  return (
    <Card title="Changes" actions={<span className="muted text-xs">Untick anything you don&apos;t want</span>}>
      <ul className="flex flex-col gap-3">
        {bullets.map((s) =>
          s.kind === "add-bullet" ? (
            <li key={keyOf(s)} className={`rounded-xl border p-3 ${s.accepted ? "border-green-500/40 bg-green-500/5" : "border-[var(--border)] opacity-60"}`}>
              <div className="flex items-start gap-3">
                <input type="checkbox" className="mt-1 size-4 accent-[var(--color-brand-600)]" checked={s.accepted} onChange={(e) => onChange(s, { accepted: e.target.checked })} aria-label="Include this line" />
                <div className="min-w-0 flex-1">
                  <p className="muted mb-1 text-xs">
                    <span className="font-medium text-green-700 dark:text-green-400">+ New line</span> in {s.targetLabel}
                  </p>
                  <textarea
                    className="field min-h-[3.5rem] resize-y text-sm"
                    value={s.text}
                    onChange={(e) => onChange(s, { text: e.target.value })}
                    aria-label="Edit the new line"
                  />
                  <p className="muted mt-1 truncate text-xs" title={s.source}>
                    From JD: “{s.source}”
                  </p>
                </div>
              </div>
            </li>
          ) : null,
        )}
        {other.map((s) => (
          <li key={keyOf(s)} className={`rounded-xl border p-3 ${s.accepted ? "border-brand-500/40 bg-brand-500/5" : "border-[var(--border)] opacity-60"}`}>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 size-4 accent-[var(--color-brand-600)]" checked={s.accepted} onChange={(e) => onChange(s, { accepted: e.target.checked })} />
              <span className="min-w-0 flex-1 text-sm">
                {s.kind === "reorder-skills" && (
                  <>
                    <span className="font-medium">Reorder skills</span> so the ones in this JD come first:{" "}
                    <span className="muted">{s.order.slice(0, 6).join(", ")}…</span>
                  </>
                )}
                {s.kind === "add-skills" && (
                  <>
                    <span className="font-medium">Add confirmed skills:</span> {s.skills.join(", ")}
                  </>
                )}
                {s.kind === "summary" && (
                  <>
                    <span className="font-medium">Add to summary:</span> <span className="muted">{s.text}</span>
                  </>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function EmptyState() {
  const steps = [
    ["1", "Paste a job description", "Any role, any field. Copy it straight from the job page."],
    ["2", "Review the changes", "Lines are built from the JD and matched to your real experience. Edit or untick anything."],
    ["3", "Download PDF or Word", "The resume is fitted to 2 pages (3 at most) before it is exported."],
  ];
  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold">Tune your resume for each job in a minute</h2>
      <ol className="flex flex-col gap-4">
        {steps.map(([n, t, d]) => (
          <li key={n} className="flex gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white">{n}</span>
            <div>
              <p className="font-medium">{t}</p>
              <p className="muted text-sm">{d}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="muted mt-5 text-xs">
        Phase 1 runs fully in your browser with the rule engine — no AI key needed and nothing leaves your device except files you import.
      </p>
    </Card>
  );
}
