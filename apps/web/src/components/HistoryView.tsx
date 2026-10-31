"use client";

import { useMemo, useState } from "react";
import type { JobStatus, SavedJob } from "@/lib/store";
import { Badge, Button, Card } from "./ui";

export const STATUSES: { value: JobStatus; label: string; tone: "neutral" | "brand" | "warn" | "good" | "bad" }[] = [
  { value: "saved", label: "Saved", tone: "neutral" },
  { value: "applied", label: "Applied", tone: "brand" },
  { value: "interview", label: "Interview", tone: "warn" },
  { value: "offer", label: "Offer", tone: "good" },
  { value: "rejected", label: "Closed", tone: "bad" },
];

interface Props {
  jobs: SavedJob[];
  onOpen: (j: SavedJob) => void;
  onDelete: (id: string) => void;
  onUpdate: (j: SavedJob) => void;
}

/** Saved versions double as an application tracker. */
export function HistoryView({ jobs, onOpen, onDelete, onUpdate }: Props) {
  const [filter, setFilter] = useState<JobStatus | "all">("all");
  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s.value, jobs.filter((j) => (j.status ?? "saved") === s.value).length])), [jobs]);
  const shown = jobs.filter((j) => filter === "all" || (j.status ?? "saved") === filter);

  if (!jobs.length) {
    return (
      <Card title="Applications">
        <p className="muted text-sm">Nothing saved yet. Tune your resume for a job and press “Save version” — it appears here so you can track the application.</p>
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <FunnelTile label="All" value={jobs.length} active={filter === "all"} onClick={() => setFilter("all")} />
        {STATUSES.map((s) => (
          <FunnelTile key={s.value} label={s.label} value={counts[s.value] ?? 0} active={filter === s.value} onClick={() => setFilter(s.value)} />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((j) => {
          const status = STATUSES.find((s) => s.value === (j.status ?? "saved"))!;
          return (
            <article key={j.id} className="surface flex flex-col gap-3 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{j.title}</h3>
                  <p className="muted truncate text-sm">{j.company ?? "—"}</p>
                </div>
                <Badge tone={j.score >= 75 ? "good" : j.score >= 50 ? "warn" : "bad"}>{j.score}%</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="field w-auto py-1 text-xs"
                  value={status.value}
                  aria-label="Application status"
                  onChange={(e) => {
                    const next = e.target.value as JobStatus;
                    onUpdate({ ...j, status: next, appliedAt: next === "applied" && !j.appliedAt ? Date.now() : j.appliedAt, updatedAt: Date.now() });
                  }}
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <Badge tone={status.tone}>{status.label}</Badge>
                {j.engine === "ai" ? <Badge tone="brand">AI</Badge> : null}
              </div>
              <p className="muted text-xs">
                {j.suggestions.filter((s) => s.accepted).length} changes · {j.appliedAt ? `applied ${new Date(j.appliedAt).toLocaleDateString()}` : `updated ${new Date(j.updatedAt).toLocaleDateString()}`}
                {j.url ? (
                  <>
                    {" · "}
                    <a href={j.url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                      posting ↗
                    </a>
                  </>
                ) : null}
              </p>
              <Notes value={j.notes ?? ""} onSave={(notes) => onUpdate({ ...j, notes, updatedAt: Date.now() })} />
              <div className="mt-auto flex gap-2">
                <Button variant="primary" onClick={() => onOpen(j)}>
                  Open
                </Button>
                <Button variant="danger" onClick={() => confirm(`Delete “${j.title}”?`) && onDelete(j.id)}>
                  Delete
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function FunnelTile({ label, value, active, onClick }: { label: string; value: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`surface rounded-xl p-3 text-left transition-colors ${active ? "!border-brand-500 bg-brand-500/10" : ""}`}
    >
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="muted text-xs">{label}</p>
    </button>
  );
}

function Notes({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [local, setLocal] = useState<string | null>(null);
  return (
    <textarea
      className="field min-h-12 resize-y text-xs"
      placeholder="Notes — recruiter, interview dates, follow-ups"
      value={local ?? value}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== null && local !== value) onSave(local);
        setLocal(null);
      }}
      aria-label="Notes"
    />
  );
}
