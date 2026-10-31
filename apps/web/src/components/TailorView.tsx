"use client";

import {
  applySuggestions,
  buildTailorPrompt,
  DOC_LANGUAGES,
  extractJson,
  newId,
  providerInfo,
  SAMPLE_JD,
  tailor,
  validateAiTailor,
  type AiTailorOutcome,
  type KeywordMatch,
  type Resume,
  type Suggestion,
} from "@cvtuner/core";
import { useEffect, useMemo, useState } from "react";
import { activeModel, aiChat, aiReady, fetchJob } from "@/lib/ai";
import { INCOMING_KEY, useDraftJd, type SavedJob, type Settings } from "@/lib/store";
import { CoverLetterCard } from "./CoverLetterCard";
import { JdHighlight } from "./JdHighlight";
import { Preview } from "./Preview";
import { Badge, Button, Card, ScoreRing, Segmented } from "./ui";

interface Props {
  profile: Resume;
  settings: Settings;
  setSettings: (s: Settings) => void;
  openJob: SavedJob | null;
  onSave: (job: SavedJob) => void;
  onOpenSettings: () => void;
}

/** Stable identity for a suggestion across re-runs, so user edits survive voice/skill changes. */
const keyOf = (s: Suggestion) => (s.kind !== "add-bullet" ? s.kind : s.source === "AI suggestion" ? `b:${s.id}` : `b:${s.source}`);

type Override = { accepted?: boolean; text?: string };

interface AiRun extends AiTailorOutcome {
  jd: string;
  voice: Settings["voice"];
  label: string;
}

export function TailorView({ profile, settings, setSettings, openJob, onSave, onOpenSettings }: Props) {
  const [draft, setDraft] = useDraftJd();
  const [analyzed, setAnalyzed] = useState<string>("");
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [jobId, setJobId] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "highlight">("edit");
  const [mobilePane, setMobilePane] = useState<"changes" | "preview" | "letter">("changes");
  const [link, setLink] = useState("");
  const [linkMeta, setLinkMeta] = useState<{ url?: string; title?: string; company?: string }>({});
  const [linkState, setLinkState] = useState<{ busy: boolean; error?: string }>({ busy: false });
  const [aiRun, setAiRun] = useState<AiRun | null>(null);
  const [aiState, setAiState] = useState<{ busy: boolean; error?: string }>({ busy: false });
  const [letter, setLetter] = useState<string[] | undefined>(undefined);

  const useAi = settings.engine === "ai" && aiReady(settings.ai);

  // opening a saved job restores its JD, confirmations and line-by-line choices
  useEffect(() => {
    if (!openJob) return;
    setDraft(openJob.jd);
    setAnalyzed(openJob.jd);
    setConfirmed(openJob.confirmedSkills);
    setLinkMeta({ url: openJob.url, title: openJob.title, company: openJob.company });
    setLetter(openJob.coverLetter);
    if (openJob.engine === "ai") {
      setAiRun({ jd: openJob.jd, voice: settings.voice, suggestions: openJob.suggestions, rejected: [], label: "saved AI version" });
      setOverrides({});
    } else {
      setAiRun(null);
      setOverrides(Object.fromEntries(openJob.suggestions.map((s) => [keyOf(s), { accepted: s.accepted, text: s.kind === "add-bullet" || s.kind === "summary" ? s.text : undefined }])));
    }
    setJobId(openJob.id);
    setMode("highlight");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openJob, setDraft]);

  // text or a link shared from another app / the browser extension
  useEffect(() => {
    let incoming: { text?: string; url?: string; title?: string } | null = null;
    try {
      incoming = JSON.parse(localStorage.getItem(INCOMING_KEY) ?? "null");
      localStorage.removeItem(INCOMING_KEY);
    } catch {
      incoming = null;
    }
    if (!incoming) return;
    const text = incoming.text?.trim() ?? "";
    const url = incoming.url ?? text.match(/https?:\/\/\S+/)?.[0];
    if (text.length > 200) {
      setDraft(text);
      setLinkMeta({ url, title: incoming.title });
      setMode("edit");
    } else if (url) {
      setLink(url);
      void loadLink(url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const result = useMemo(
    () => (analyzed.trim() ? tailor(profile, analyzed, { voice: settings.voice, confirmedSkills: confirmed }) : null),
    [analyzed, profile, settings.voice, confirmed],
  );

  const aiCurrent = aiRun && aiRun.jd === analyzed ? aiRun : null;
  const baseSuggestions = aiCurrent ? aiCurrent.suggestions : (result?.suggestions ?? []);

  const suggestions: Suggestion[] = useMemo(
    () =>
      baseSuggestions.map((s) => {
        const o = overrides[keyOf(s)];
        if (!o) return s;
        const next = { ...s, accepted: o.accepted ?? s.accepted } as Suggestion;
        if (o.text && (next.kind === "add-bullet" || next.kind === "summary")) next.text = o.text;
        return next;
      }),
    [baseSuggestions, overrides],
  );

  const tuned = useMemo(() => applySuggestions(profile, suggestions), [profile, suggestions]);
  const protect = suggestions.flatMap((s) => (s.accepted && s.kind === "add-bullet" ? [s.text] : []));
  const keywords = result?.keywords.map((k) => k.name) ?? [];
  const title = linkMeta.title ?? aiCurrent?.jobTitle ?? result?.jd.title;
  const company = linkMeta.company ?? aiCurrent?.company ?? result?.jd.company;

  async function loadLink(url = link) {
    if (!url.trim()) return;
    setLinkState({ busy: true });
    try {
      const { job } = await fetchJob(url.trim());
      if (!job) throw new Error("No job found at that link.");
      setDraft(job.text);
      setLinkMeta({ url: job.url, title: job.title, company: job.company });
      setMode("edit");
      setLinkState({ busy: false });
    } catch (e) {
      setLinkState({ busy: false, error: (e as Error).message });
    }
  }

  const runAi = async (jd: string, rule = tailor(profile, jd, { voice: settings.voice, confirmedSkills: confirmed })) => {
    setAiState({ busy: true });
    try {
      const input = {
        resume: profile,
        jd,
        voice: settings.voice,
        confirmedSkills: confirmed,
        gaps: rule.gaps.map((g) => g.name),
        language: DOC_LANGUAGES[settings.lang]?.name ?? "English",
      };
      const reply = await aiChat(settings.ai, buildTailorPrompt(input));
      const outcome = validateAiTailor(extractJson(reply), input, rule);
      setAiRun({ ...outcome, jd, voice: settings.voice, label: `${providerInfo(settings.ai.provider).name} · ${activeModel(settings.ai)}` });
      setOverrides({});
      setAiState({ busy: false });
    } catch (e) {
      setAiRun(null);
      setAiState({ busy: false, error: `${(e as Error).message} Showing rule-engine changes instead.` });
    }
  };

  const analyze = () => {
    setAnalyzed(draft);
    setMode("highlight");
    if (draft !== openJob?.jd) {
      setJobId(null);
      setLetter(undefined);
    }
    if (useAi) void runAi(draft);
    else setAiRun(null);
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
      title: title ?? "Untitled role",
      company,
      jd: analyzed,
      url: linkMeta.url,
      createdAt: openJob?.id === id ? openJob.createdAt : now,
      updatedAt: now,
      confirmedSkills: confirmed,
      suggestions,
      engine: aiCurrent ? "ai" : "rules",
      coverLetter: letter,
      score: result.score,
      status: openJob?.id === id ? openJob.status : "saved",
      appliedAt: openJob?.id === id ? openJob.appliedAt : undefined,
      notes: openJob?.id === id ? openJob.notes : undefined,
    });
  };

  const covered = result?.keywords.filter((k) => k.coverage === "covered") ?? [];
  const missing = result?.keywords.filter((k) => k.coverage === "missing") ?? [];
  const style = { template: settings.template, lang: settings.lang };

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
          <form
            className="mb-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void loadLink();
            }}
          >
            <input
              className="field"
              type="url"
              inputMode="url"
              placeholder="Job link — Greenhouse, Lever, Ashby, Workable, company career pages…"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              aria-label="Job link"
            />
            <Button type="submit" disabled={!link.trim() || linkState.busy}>
              {linkState.busy ? "Fetching…" : "Fetch"}
            </Button>
          </form>
          {linkState.error ? (
            <p className="mb-3 rounded-lg bg-amber-500/10 p-2.5 text-sm text-amber-800 dark:text-amber-300" role="alert">
              {linkState.error}
            </p>
          ) : null}
          {mode === "edit" || !result ? (
            <textarea
              className="field min-h-[260px] resize-y font-mono text-[13px] leading-relaxed lg:min-h-[340px]"
              placeholder="…or paste the full job description here — responsibilities, requirements, nice-to-haves. Any field works: nursing, finance, sales, software…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Job description"
            />
          ) : (
            <JdHighlight text={analyzed} keywords={result.keywords} />
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="muted text-xs">
              {draft.trim() ? `${draft.trim().split(/\s+/).length} words` : "Nothing pasted yet"}
              {" · "}
              {useAi ? (
                <button type="button" className="text-brand-600 hover:underline" onClick={onOpenSettings}>
                  AI: {providerInfo(settings.ai.provider).name}
                </button>
              ) : (
                <button type="button" className="hover:underline" onClick={onOpenSettings}>
                  Rule engine{settings.engine === "ai" ? " (add an AI key in Settings)" : ""}
                </button>
              )}
            </span>
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
                    setAiRun(null);
                    setLetter(undefined);
                    setLink("");
                    setLinkMeta({});
                    setMode("edit");
                  }}
                >
                  Clear
                </Button>
              ) : null}
              <Button variant="primary" onClick={analyze} disabled={!draft.trim() || aiState.busy}>
                {aiState.busy ? "AI is writing…" : analyzed && analyzed === draft ? "Re-tune" : "Tune my resume"}
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
                {title ? <p className="font-medium">{title}</p> : null}
                {company ? <p className="muted">{company}</p> : null}
                {linkMeta.url ? (
                  <a href={linkMeta.url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline">
                    Open job posting ↗
                  </a>
                ) : null}
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
                <p className="muted mt-2 text-xs">CVTuner never adds a skill you have not confirmed.{useAi && aiCurrent ? " Re-run AI after confirming skills." : ""}</p>
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
                  { value: "preview", label: "Resume" },
                  { value: "letter", label: "Cover letter" },
                ]}
              />
            </div>

            <div className={mobilePane === "changes" ? "" : "hidden lg:block"}>
              {aiState.error ? (
                <p className="mb-3 rounded-lg bg-amber-500/10 p-2.5 text-sm text-amber-800 dark:text-amber-300" role="alert">
                  {aiState.error}
                </p>
              ) : null}
              <Changes
                suggestions={suggestions}
                onChange={setOverride}
                aiLabel={aiCurrent?.label}
                staleVoice={!!aiCurrent && aiCurrent.voice !== settings.voice}
                rejected={aiCurrent?.rejected ?? []}
                busy={aiState.busy}
                onRerunAi={useAi ? () => void runAi(analyzed) : undefined}
              />
            </div>
            <div className={mobilePane === "preview" ? "" : "hidden lg:block"}>
              <Preview resume={tuned} maxPages={settings.maxPages} keywords={keywords} protect={protect} title={title} company={company} style={style} />
            </div>
            <div className={mobilePane === "letter" ? "" : "hidden lg:block"}>
              <CoverLetterCard
                resume={tuned}
                jd={analyzed}
                keywords={result.keywords}
                gaps={result.gaps.map((g) => g.name)}
                title={title}
                company={company}
                settings={settings}
                useAi={useAi}
                value={letter}
                onChange={setLetter}
              />
            </div>
          </>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

function Changes({
  suggestions,
  onChange,
  aiLabel,
  staleVoice,
  rejected,
  busy,
  onRerunAi,
}: {
  suggestions: Suggestion[];
  onChange: (s: Suggestion, o: Override) => void;
  aiLabel?: string;
  staleVoice: boolean;
  rejected: { text: string; reason: string }[];
  busy: boolean;
  onRerunAi?: () => void;
}) {
  const bullets = suggestions.filter((s) => s.kind === "add-bullet");
  const other = suggestions.filter((s) => s.kind !== "add-bullet");
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          Changes {aiLabel ? <Badge tone="brand">AI · {aiLabel}</Badge> : <Badge>Rule engine</Badge>}
        </span>
      }
      actions={
        onRerunAi ? (
          <Button variant="ghost" onClick={onRerunAi} disabled={busy}>
            {busy ? "Writing…" : aiLabel ? "Re-run AI" : "Write with AI"}
          </Button>
        ) : (
          <span className="muted text-xs">Untick anything you don&apos;t want</span>
        )
      }
    >
      {staleVoice ? <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">You changed the voice — re-run AI to rewrite these lines.</p> : null}
      {!suggestions.length ? (
        <p className="muted text-sm">No safe changes found. Add more detail to your profile, or confirm missing skills you actually have.</p>
      ) : (
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
                    <textarea className="field min-h-[3.5rem] resize-y text-sm" value={s.text} onChange={(e) => onChange(s, { text: e.target.value })} aria-label="Edit the new line" />
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
                      <span className="font-medium">Reorder skills</span> so the ones in this JD come first: <span className="muted">{s.order.slice(0, 6).join(", ")}…</span>
                    </>
                  )}
                  {s.kind === "add-skills" && (
                    <>
                      <span className="font-medium">Add confirmed skills:</span> {s.skills.join(", ")}
                    </>
                  )}
                  {s.kind === "summary" && (
                    <>
                      <span className="font-medium">{s.replace ? "Replace summary with:" : "Add to summary:"}</span> <span className="muted">{s.text}</span>
                    </>
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {rejected.length ? (
        <details className="mt-3 text-sm">
          <summary className="muted cursor-pointer text-xs">
            {rejected.length} AI line{rejected.length > 1 ? "s" : ""} removed by the truth check
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {rejected.map((r, i) => (
              <li key={i} className="muted text-xs">
                <span className="line-through">{r.text}</span> — {r.reason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}

function EmptyState() {
  const steps = [
    ["1", "Paste a job description or link", "Any role, any field. Links from Greenhouse, Lever, Ashby, Workable and most career pages are fetched for you."],
    ["2", "Review the changes", "Lines are matched to your real experience — by the rule engine, or by the AI provider you pick in Settings. Edit or untick anything."],
    ["3", "Download resume and cover letter", "PDF or Word, fitted to 2 pages (3 at most), in three ATS-safe templates."],
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
      <p className="muted mt-5 text-xs">The rule engine runs fully in your browser — no AI key needed. Add a free Gemini, Groq or OpenRouter key in Settings for AI rewriting.</p>
    </Card>
  );
}
