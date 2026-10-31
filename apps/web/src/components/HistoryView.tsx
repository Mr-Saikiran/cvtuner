import type { SavedJob } from "@/lib/store";
import { Badge, Button, Card } from "./ui";

export function HistoryView({ jobs, onOpen, onDelete }: { jobs: SavedJob[]; onOpen: (j: SavedJob) => void; onDelete: (id: string) => void }) {
  if (!jobs.length) {
    return (
      <Card title="Saved versions">
        <p className="muted text-sm">Nothing saved yet. Tune your resume for a job and press “Save version”.</p>
      </Card>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((j) => (
        <article key={j.id} className="surface flex flex-col gap-3 rounded-2xl p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-semibold">{j.title}</h3>
              <p className="muted truncate text-sm">{j.company ?? "—"}</p>
            </div>
            <Badge tone={j.score >= 75 ? "good" : j.score >= 50 ? "warn" : "bad"}>{j.score}% match</Badge>
          </div>
          <p className="muted text-xs">
            {j.suggestions.filter((s) => s.accepted).length} changes · updated {new Date(j.updatedAt).toLocaleDateString()}
          </p>
          <div className="mt-auto flex gap-2">
            <Button variant="primary" onClick={() => onOpen(j)}>
              Open
            </Button>
            <Button variant="danger" onClick={() => confirm(`Delete “${j.title}”?`) && onDelete(j.id)}>
              Delete
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
