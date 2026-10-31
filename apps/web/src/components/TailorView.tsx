"use client";

import { applySuggestions, newId, SAMPLE_JD, tailor, type KeywordMatch, type Resume, type Suggestion } from "@cvtuner/core";
import { useEffect, useMemo, useState } from "react";
import { useDraftJd, type SavedJob, type Settings } from "@/lib/store";
import { JdHighlight } from "./JdHighlight";
import { Preview } from "./Preview";
import { Button, Card, Score, Segmented } from "./ui";

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
  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-8">
      {/* the JD and the match stay in view while the long Changes list scrolls */}
      <div className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-6">
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
                    { value: "highlight", label: "Marked" },
                  ]}
                />
              ) : null}
              {words ? (
                <span className="code text-muted">{words} words</span>
              ) : (
                <span className="text-muted text-xs">nothing pasted yet</span>
              )}
            </>
          }
        >
          <div className="mb-3">
            <input
              className="field"
              type="url"
              placeholder="Job link (LinkedIn, Naukri, Greenhouse). Coming in Phase 2."
              disabled
              aria-label="Job link (coming soon)"
            />
          </div>
          {mode === "edit" || !result ? (
            <textarea
              className="field min-h-[280px] resize-y text-sm leading-relaxed lg:min-h-[360px]"
              placeholder="Paste the full job description here: responsibilities, requirements, nice-to-haves. Any field works: nursing, finance, sales, software."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Job description"
            />
          ) : (
            <>
              <JdHighlight text={analyzed} keywords={result.keywords} />
              {/* the marking is not colour alone: say what each one means */}
              <p className="text-muted border-rule mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t pt-2 text-xs">
                <span>
                  <mark className="kw-covered">In your resume</mark>
                </span>
                <span>
                  <mark className="kw-missing">Missing</mark>
                </span>
                <span>
                  <mark className="kw-confirmed">Confirmed by you</mark>
                </span>
              </p>
            </>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            {!draft ? (
              <Button variant="ghost" onClick={() => setDraft(SAMPLE_JD)}>
                Try a sample
              </Button>
            ) : (
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
            )}
            {/* the fill moves to the download once there is something to download */}
            <Button variant={result ? "secondary" : "primary"} onClick={analyze} disabled={!draft.trim()}>
              {analyzed && analyzed === draft ? "Re-tune" : "Tune my resume"}
            </Button>
          </div>
        </Card>

        {result ? (
          <Card title="Match">
            <div className="flex flex-wrap items-end gap-8">
              <Score value={result.score} label={<>Keyword match, before tuning</>} />
              {result.projectedScore > result.score ? <Score value={result.projectedScore} label="After tuning" /> : null}
              <div className="min-w-0 flex-1 text-sm">
                {result.jd.title ? <p className="font-medium">{result.jd.title}</p> : null}
                {result.jd.company ? <p className="text-muted">{result.jd.company}</p> : null}
              </div>
            </div>

            {covered.length ? (
              <div className="border-rule mt-6 border-t pt-4">
                <p className="text-muted mb-2 text-xs font-medium">
                  In your resume <span className="code">{covered.length}</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {covered.map((k) => (
                    <span key={k.name} className="chip">
                      {k.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {missing.length ? (
              <div className="border-rule mt-5 border-t pt-4">
                <p className="text-muted mb-2 text-xs font-medium">
                  Missing from your resume <span className="code">{missing.length}</span>. Tap the ones you really have.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {missing.map((k) => (
                    <button
                      key={k.name}
                      type="button"
                      onClick={() => toggleConfirm(k)}
                      aria-pressed={k.confirmed}
                      className={`chip ${k.confirmed ? "chip--confirmed" : "chip--missing"}`}
                    >
                      <span className="code" aria-hidden>
                        {k.confirmed ? "✓" : "+"}
                      </span>
                      {k.name}
                    </button>
                  ))}
                </div>
                <p className="text-muted mt-3 text-xs">CVTuner never adds a skill you have not confirmed.</p>
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        {result ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="text-muted text-xs">Sentence voice</span>
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
                <span className="text-muted text-xs">Page limit</span>
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
                  { value: "preview", label: "Preview" },
                ]}
              />
            </div>

            <div className={mobilePane === "preview" ? "" : "hidden lg:block"}>
              <Preview resume={tuned} maxPages={settings.maxPages} keywords={keywords} protect={protect} title={result.jd.title} company={result.jd.company} />
            </div>
            <div className={mobilePane === "changes" ? "" : "hidden lg:block"}>
              <Changes suggestions={suggestions} onChange={setOverride} />
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
        <p className="text-muted text-sm">
          No safe changes found. Add more detail to your profile, or confirm missing skills you actually have.
        </p>
      </Card>
    );
  }
  const bullets = suggestions.filter((s) => s.kind === "add-bullet");
  const other = suggestions.filter((s) => s.kind !== "add-bullet");
  return (
    <Card title="Changes" actions={<span className="text-muted text-xs">Untick anything you don&apos;t want</span>}>
      <ul className="flex flex-col">
        {bullets.map((s) =>
          s.kind === "add-bullet" ? (
            <li
              key={keyOf(s)}
              className={`border-rule flex items-start gap-3 border-b py-4 first:pt-0 ${s.accepted ? "" : "opacity-55"}`}
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={s.accepted}
                onChange={(e) => onChange(s, { accepted: e.target.checked })}
                aria-label="Include this line"
              />
              <div className="min-w-0 flex-1">
                <p className="text-muted mb-1.5 text-xs">
                  {/* core joins position and company with a middle dot; 63 bans that on the page */}
                  New line in <span className="text-ink font-medium">{s.targetLabel.replace(" · ", " at ")}</span>
                </p>
                <textarea
                  className="field min-h-[3.5rem] resize-y text-sm"
                  value={s.text}
                  onChange={(e) => onChange(s, { text: e.target.value })}
                  aria-label="Edit the new line"
                />
                <p className="text-muted mt-1.5 truncate text-xs" title={s.source}>
                  From JD: “{s.source}”
                </p>
              </div>
            </li>
          ) : null,
        )}
        {other.map((s) => (
          <li key={keyOf(s)} className={`border-rule border-b py-4 last:border-b-0 ${s.accepted ? "" : "opacity-55"}`}>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-0.5" checked={s.accepted} onChange={(e) => onChange(s, { accepted: e.target.checked })} />
              <span className="min-w-0 flex-1 text-sm">
                {s.kind === "reorder-skills" && (
                  <>
                    <span className="font-medium">Reorder skills</span> so the ones in this JD come first:{" "}
                    <span className="text-muted">{s.order.slice(0, 6).join(", ")}…</span>
                  </>
                )}
                {s.kind === "add-skills" && (
                  <>
                    <span className="font-medium">Add confirmed skills:</span> {s.skills.join(", ")}
                  </>
                )}
                {s.kind === "summary" && (
                  <>
                    <span className="font-medium">Add to summary:</span> <span className="text-muted">{s.text}</span>
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

/** What belongs in this column, and the one action that fills it. Steps hung from hairlines. */
function EmptyState() {
  const steps = [
    ["1", "Paste a job description", "Any role, any field. Copy it straight from the job page."],
    ["2", "Review the changes", "Lines are built from the JD and matched to your real experience. Edit or untick anything."],
    ["3", "Download PDF or Word", "The resume is fitted to 2 pages (3 at most) before it is exported."],
  ];
  return (
    <Card title="Tune your resume for each job in a minute">
      <ol className="flex flex-col">
        {steps.map(([n, t, d]) => (
          <li key={n} className="border-rule flex gap-4 border-b py-4 first:pt-0 last:border-b-0">
            <span className="font-display text-section text-muted leading-none font-bold">{n}</span>
            <div className="min-w-0">
              <p className="font-medium">{t}</p>
              <p className="text-muted text-sm">{d}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-muted border-rule mt-4 border-t pt-4 text-xs">
        Phase 1 runs fully in your browser with the rule engine. No AI key needed, and nothing leaves your device except files you import.
      </p>
    </Card>
  );
}
