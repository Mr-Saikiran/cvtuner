"use client";

import { newId, parseResume, screenCandidates, type Resume } from "@cvtuner/core";
import { useMemo, useRef, useState } from "react";
import { downloadBlob } from "@/lib/files";
import { Badge, Button, Card } from "./ui";

interface Candidate {
  id: string;
  fileName: string;
  resume: Resume;
}

/**
 * Recruiter mode — a lightweight ATS: drop in many resumes, paste one job description,
 * get candidates ranked by match with matched and missing skills. Nothing leaves this browser
 * except each file's one-time text extraction.
 */
export function ScreenView() {
  const [jd, setJd] = useState("");
  const [mustHave, setMustHave] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [shortlist, setShortlist] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const ranked = useMemo(
    () => (jd.trim() && candidates.length ? screenCandidates(jd, candidates, mustHave.split(",").map((s) => s.trim()).filter(Boolean)) : []),
    [jd, candidates, mustHave],
  );

  const addFiles = async (files: FileList) => {
    const list = [...files].slice(0, 200);
    const failed: string[] = [];
    for (let i = 0; i < list.length; i++) {
      const file = list[i]!;
      setProgress(`Reading ${i + 1} of ${list.length}: ${file.name}`);
      try {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/cvtuner/api/import", { method: "POST", body });
        const data = (await res.json()) as { resume?: Resume; error?: string };
        if (!res.ok || !data.resume) throw new Error(data.error ?? "unreadable");
        setCandidates((prev) => [...prev, { id: newId("cand"), fileName: file.name, resume: parseResume(data.resume) }]);
      } catch (e) {
        failed.push(`${file.name}: ${(e as Error).message}`);
      }
    }
    setErrors(failed);
    setProgress(null);
  };

  const exportCsv = () => {
    const esc = (v: string | number | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["Rank", "Name", "Email", "Headline", "Match %", "Years", "Shortlisted", "Matched skills", "Missing skills", "File"],
      ...ranked.map((c, i) => [i + 1, c.name, c.email, c.headline, c.score, c.years, shortlist.has(c.id) ? "yes" : "", c.matched.join("; "), c.missing.join("; "), c.fileName]),
    ];
    downloadBlob(new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" }), "cvtuner-screening.csv");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <Card title={<span className="flex items-center gap-2">Screen candidates <Badge tone="brand">Recruiter</Badge></span>}>
          <p className="muted mb-3 text-sm">A simple ATS: upload resumes, paste the job description, and candidates are ranked by how well they match.</p>
          <textarea className="field min-h-40 text-[13px]" placeholder="Paste the job description" value={jd} onChange={(e) => setJd(e.target.value)} aria-label="Job description for screening" />
          <label className="mt-3 flex flex-col gap-1 text-sm">
            <span className="muted text-xs font-medium">Must-have skills (comma separated, optional)</span>
            <input className="field" value={mustHave} onChange={(e) => setMustHave(e.target.value)} placeholder="e.g. SAP, Negotiation" />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => fileRef.current?.click()} disabled={!!progress}>
              Upload resumes
            </Button>
            {candidates.length ? (
              <Button
                variant="danger"
                onClick={() => {
                  setCandidates([]);
                  setShortlist(new Set());
                }}
              >
                Clear all
              </Button>
            ) : null}
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.md,.json"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {progress ? <p className="muted mt-2 text-xs" role="status">{progress}</p> : null}
          {errors.length ? (
            <details className="mt-2 text-xs text-red-600">
              <summary>{errors.length} file(s) could not be read</summary>
              {errors.map((e) => (
                <p key={e}>{e}</p>
              ))}
            </details>
          ) : null}
          <p className="muted mt-3 text-xs">
            Candidates missing a must-have skill are ranked lower. The resumes are kept only in this tab and are gone when you close it.
          </p>
        </Card>
      </div>

      <Card
        title={`Ranked candidates${ranked.length ? ` (${ranked.length})` : ""}`}
        actions={ranked.length ? <Button onClick={exportCsv}>Export CSV</Button> : undefined}
      >
        {!ranked.length ? (
          <p className="muted text-sm">{candidates.length ? "Paste a job description to rank the resumes." : "Upload PDF or Word resumes to start."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="muted text-xs">
                <tr>
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Candidate</th>
                  <th className="py-2 pr-2">Match</th>
                  <th className="py-2 pr-2">Years</th>
                  <th className="py-2 pr-2">Missing</th>
                  <th className="py-2">Shortlist</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {ranked.map((c, i) => (
                  <tr key={c.id}>
                    <td className="py-2 pr-2 tabular-nums">{i + 1}</td>
                    <td className="py-2 pr-2">
                      <p className="font-medium">{c.name}</p>
                      <p className="muted text-xs">{[c.headline, c.email].filter(Boolean).join(" · ") || c.fileName}</p>
                    </td>
                    <td className="py-2 pr-2">
                      <Badge tone={c.score >= 70 ? "good" : c.score >= 45 ? "warn" : "bad"}>{c.score}%</Badge>
                    </td>
                    <td className="py-2 pr-2 tabular-nums">{c.years || "—"}</td>
                    <td className="muted py-2 pr-2 text-xs">{c.missing.slice(0, 4).join(", ") || "—"}</td>
                    <td className="py-2">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--color-brand-600)]"
                        checked={shortlist.has(c.id)}
                        onChange={(e) =>
                          setShortlist((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(c.id);
                            else next.delete(c.id);
                            return next;
                          })
                        }
                        aria-label={`Shortlist ${c.name}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
