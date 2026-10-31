import type { SavedJob } from "@/lib/store";
import { Button, Card } from "./ui";

export function HistoryView({ jobs, onOpen, onDelete }: { jobs: SavedJob[]; onOpen: (j: SavedJob) => void; onDelete: (id: string) => void }) {
  if (!jobs.length) {
    return (
      <Card title="Saved versions">
        <p className="text-muted text-sm">Nothing saved yet. Tune your resume for a job and press “Save version”.</p>
      </Card>
    );
  }
  return (
    <section className="card">
      <div className="card-head">
        <h2>
          Saved versions <span className="code text-muted">{jobs.length}</span>
        </h2>
      </div>
      <div className="card-body">
        <table className="spec spec--stack">
          <thead>
            <tr>
              <th scope="col">Role</th>
              <th scope="col">Company</th>
              <th scope="col">Match</th>
              <th scope="col">Changes</th>
              <th scope="col">Updated</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td data-label="">
                  <span className="font-medium">{j.title}</span>
                </td>
                <td data-label="Company" className="text-muted">
                  {j.company ?? "not named"}
                </td>
                <td data-label="Match">
                  <span className={`code ${j.score >= 75 ? "" : j.score >= 50 ? "text-ink-2" : "text-warn"}`}>{j.score}%</span>
                </td>
                <td data-label="Changes" className="code text-muted">
                  {j.suggestions.filter((s) => s.accepted).length}
                </td>
                <td data-label="Updated" className="code text-muted">
                  {new Date(j.updatedAt).toLocaleDateString()}
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
