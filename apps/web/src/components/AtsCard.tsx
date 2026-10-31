import type { AtsReport } from "@cvtuner/core";
import { Card, ScoreRing } from "./ui";

const ICON = { pass: "✓", warn: "!", fail: "✕" } as const;
const TONE = {
  pass: "bg-green-500/15 text-green-700 dark:text-green-400",
  warn: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  fail: "bg-red-500/15 text-red-700 dark:text-red-400",
} as const;

/** How an Applicant Tracking System and a recruiter's keyword search will see the tuned resume. */
export function AtsCard({ report }: { report: AtsReport }) {
  const issues = report.checks.filter((c) => c.status !== "pass").length;
  return (
    <Card title="ATS check" actions={<span className="muted text-xs">{issues ? `${issues} to improve` : "Ready to submit"}</span>}>
      <div className="flex items-start gap-4">
        <ScoreRing value={report.score} label={<>ATS<br />readiness</>} />
        <ul className="flex min-w-0 flex-1 flex-col gap-2">
          {[...report.checks]
            .sort((a, b) => ["fail", "warn", "pass"].indexOf(a.status) - ["fail", "warn", "pass"].indexOf(b.status))
            .map((c) => (
              <li key={c.id} className="flex gap-2 text-sm">
                <span className={`grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${TONE[c.status]}`} aria-label={c.status}>
                  {ICON[c.status]}
                </span>
                <span className="min-w-0">
                  <span className="font-medium">{c.label}</span> <span className="muted">— {c.detail}</span>
                </span>
              </li>
            ))}
        </ul>
      </div>
    </Card>
  );
}
