"use client";

import { useMemo, useState } from "react";
import type { JobStatus, SavedJob } from "@/lib/store";
import { Button, Segmented } from "./ui";

export const STATUSES: { value: JobStatus; label: string }[] = [
  { value: "saved", label: "Saved" },
  { value: "applied", label: "Applied" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Closed" },
];

interface Props {
  jobs: SavedJob[];
  onOpen: (j: SavedJob) => void;
  onDelete: (id: string) => void;
  onUpdate: (j: SavedJob) => void;
}

/** Saved versions double as the application tracker: a spec table with status, dates and notes. */
export function HistoryView({ jobs, onOpen, onDelete, onUpdate }: Props) {
  const [filter, setFilter] = useState<JobStatus | "all">("all");
  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s.value, jobs.filter((j) => (j.status ?? "saved") === s.value).length])), [jobs]);
  const shown = jobs.filter((j) => filter === "all" || (j.status ?? "saved") === filter);

  if (!jobs.length) {
    return (
      <section className="card">
        <div className="card-head">
          <h2>Applications</h2>
        </div>
        <div className="card-body">
          <p className="text-muted text-sm">Nothing saved yet. Tune your resume for a job and press “Save version”. It appears here so you can track the application.</p>
        </div>
      </section>
    );
  }
  return (
    <section className="card">
      <div className="card-head">
        <h2>
          Applications <span className="code text-muted">{jobs.length}</span>
        </h2>
        <div className="max-w-full overflow-x-auto">
          <Segmented
            label="Filter by status"
            value={filter}
            onChange={setFilter}
            options={[{ value: "all" as const, label: `All ${jobs.length}` }, ...STATUSES.map((s) => ({ value: s.value, label: `${s.label} ${counts[s.value] ?? 0}` }))]}
          />
        </div>
      </div>
      <div className="card-body">
        {!shown.length ? <p className="text-muted text-sm">No applications with this status.</p> : null}
        <table className="spec spec--stack" hidden={!shown.length}>
          <thead>
            <tr>
              <th scope="col">Role</th>
              <th scope="col">Company</th>
              <th scope="col">Match</th>
              <th scope="col">Status</th>
              <th scope="col">Applied</th>
              <th scope="col">Notes</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((j) => (
              <tr key={j.id}>
                <td data-label="">
                  <span className="font-medium">{j.title}</span>
                  {j.url ? (
                    <a href={j.url} target="_blank" rel="noreferrer" className="text-muted ml-2 text-xs">
                      posting ↗
                    </a>
                  ) : null}
                  {j.engine === "ai" ? <span className="code text-muted ml-2 text-xs">AI</span> : null}
                </td>
                <td data-label="Company" className="text-muted">
                  {j.company ?? "not named"}
                </td>
                <td data-label="Match">
                  <span className={`code ${j.score >= 75 ? "" : j.score >= 50 ? "text-ink-2" : "text-warn"}`}>{j.score}%</span>
                </td>
                <td data-label="Status">
                  <select
                    className="field w-auto py-1 text-xs"
                    value={j.status ?? "saved"}
                    aria-label={`Status of ${j.title}`}
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
                </td>
                <td data-label="Applied" className="code text-muted">
                  {j.appliedAt ? new Date(j.appliedAt).toLocaleDateString() : "not yet"}
                </td>
                <td data-label="Notes">
                  <Notes title={j.title} value={j.notes ?? ""} onSave={(notes) => onUpdate({ ...j, notes, updatedAt: Date.now() })} />
                </td>
                <td data-label="">
                  <span className="flex justify-end gap-1">
                    <Button onClick={() => onOpen(j)}>Open</Button>
                    <Button variant="danger" onClick={() => confirm(`Delete “${j.title}”?`) && onDelete(j.id)}>
                      Delete
                    </Button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Notes({ title, value, onSave }: { title: string; value: string; onSave: (v: string) => void }) {
  const [local, setLocal] = useState<string | null>(null);
  return (
    <input
      className="field min-w-40 py-1 text-xs"
      placeholder="Recruiter, interview date…"
      value={local ?? value}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== null && local !== value) onSave(local);
        setLocal(null);
      }}
      aria-label={`Notes for ${title}`}
    />
  );
}
