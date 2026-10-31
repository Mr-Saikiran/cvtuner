"use client";

import { emptyResume, newId, parseResumeText, sampleResume, type Education, type Project, type Resume } from "@cvtuner/core";
import { useRef, useState } from "react";
import { downloadBlob } from "@/lib/files";
import { Button, Card } from "./ui";

interface Props {
  profile: Resume;
  setProfile: (r: Resume | ((p: Resume) => Resume)) => void;
}

export function ProfileView({ profile, setProfile }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");

  const importFile = async (file: File) => {
    setStatus(`Reading ${file.name}…`);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/cvtuner/api/import", { method: "POST", body });
      const data = (await res.json()) as { resume?: Resume; error?: string };
      if (!res.ok || !data.resume) throw new Error(data.error ?? "Import failed");
      setProfile(data.resume);
      setStatus(`Imported ${file.name}. Check each section below. Automatic parsing is not perfect.`);
    } catch (e) {
      setStatus((e as Error).message);
    }
  };

  const set = (fn: (r: Resume) => void) =>
    setProfile((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <Card
        title="Your base resume"
        actions={
          <>
            <Button variant="primary" onClick={() => fileRef.current?.click()}>
              Upload PDF / Word
            </Button>
            <Button onClick={() => setPasteOpen((v) => !v)} aria-expanded={pasteOpen}>
              Paste text
            </Button>
            <Button variant="ghost" onClick={() => setProfile(sampleResume())}>
              Load sample
            </Button>
          </>
        }
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.txt,.md,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
            e.target.value = "";
          }}
        />
        <p className="text-muted max-w-[65ch] text-sm">
          This is the master copy. CVTuner never changes it when tuning. Each job gets its own version.
        </p>
        <p className="help mt-2" role="status">
          {status}
        </p>
        {pasteOpen ? (
          <div className="mt-3 flex flex-col gap-2">
            <textarea
              className="field min-h-48 text-sm"
              placeholder="Paste your resume as plain text"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              aria-label="Resume as plain text"
            />
            <div className="flex justify-end">
              <Button
                disabled={!pasted.trim()}
                onClick={() => {
                  setProfile(parseResumeText(pasted));
                  setPasteOpen(false);
                  setPasted("");
                  setStatus("Imported pasted text. Check each section below.");
                }}
              >
                Import text
              </Button>
            </div>
          </div>
        ) : null}
        <div className="border-rule mt-4 flex flex-wrap justify-between gap-2 border-t pt-4">
          <Button
            variant="ghost"
            onClick={() => downloadBlob(new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" }), "cvtuner-profile.json")}
          >
            Export JSON
          </Button>
          <Button variant="danger" onClick={() => confirm("Clear your whole profile?") && setProfile(emptyResume())}>
            Clear profile
          </Button>
        </div>
      </Card>

      <Card title="Basics">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" value={profile.basics.name} onChange={(v) => set((r) => void (r.basics.name = v))} autoComplete="name" />
          <Field label="Headline" value={profile.basics.label} onChange={(v) => set((r) => void (r.basics.label = v))} placeholder="e.g. Staff Nurse, Data Analyst" />
          <Field label="Email" value={profile.basics.email} onChange={(v) => set((r) => void (r.basics.email = v))} type="email" autoComplete="email" />
          <Field label="Phone" value={profile.basics.phone} onChange={(v) => set((r) => void (r.basics.phone = v))} type="tel" autoComplete="tel" />
          <Field label="Location" value={profile.basics.location} onChange={(v) => set((r) => void (r.basics.location = v))} autoComplete="address-level2" />
          <Field label="Website / LinkedIn" value={profile.basics.url} onChange={(v) => set((r) => void (r.basics.url = v))} type="url" autoComplete="url" />
        </div>
        <Area label="Summary" value={profile.basics.summary} onChange={(v) => set((r) => void (r.basics.summary = v))} className="mt-3" />
      </Card>

      <Card
        title="Experience"
        actions={<Button onClick={() => set((r) => void r.work.unshift({ id: newId("work"), name: "", position: "", highlights: [] }))}>Add role</Button>}
      >
        <div className="flex flex-col">
          {profile.work.length === 0 ? <p className="text-muted text-sm">No roles yet.</p> : null}
          {profile.work.map((w, i) => (
            <Entry
              key={w.id}
              onRemove={() => set((r) => void r.work.splice(i, 1))}
              onUp={i > 0 ? () => set((r) => void r.work.splice(i - 1, 0, r.work.splice(i, 1)[0]!)) : undefined}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Job title" value={w.position} onChange={(v) => set((r) => void (r.work[i]!.position = v))} />
                <Field label="Company" value={w.name} onChange={(v) => set((r) => void (r.work[i]!.name = v))} />
                <Field label="Location" value={w.location} onChange={(v) => set((r) => void (r.work[i]!.location = v))} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start" value={w.startDate} onChange={(v) => set((r) => void (r.work[i]!.startDate = v))} placeholder="Jan 2021" />
                  <Field label="End" value={w.endDate} onChange={(v) => set((r) => void (r.work[i]!.endDate = v))} placeholder="Present" />
                </div>
              </div>
              <Lines label="Highlights (one per line)" value={w.highlights} onChange={(v) => set((r) => void (r.work[i]!.highlights = v))} />
            </Entry>
          ))}
        </div>
      </Card>

      <Card title="Skills">
        {(profile.skills.length ? profile.skills : [{ id: "new", name: "Skills", keywords: [] }]).map((g, i) => (
          <Area
            key={g.id}
            label={profile.skills.length > 1 ? g.name : "Skills (comma separated)"}
            value={g.keywords.join(", ")}
            onChange={(v) =>
              set((r) => {
                if (!r.skills[i]) r.skills[i] = { id: newId("skill"), name: "Skills", keywords: [] };
                r.skills[i]!.keywords = v.split(/,\s*/).map((s) => s.trim()).filter(Boolean);
              })
            }
            commitOnBlur
          />
        ))}
      </Card>

      <Card
        title="Education"
        actions={<Button onClick={() => set((r) => void r.education.push({ id: newId("edu"), institution: "" } as Education))}>Add</Button>}
      >
        <div className="flex flex-col">
          {profile.education.length === 0 ? <p className="text-muted text-sm">Nothing yet.</p> : null}
          {profile.education.map((e, i) => (
            <Entry key={e.id} onRemove={() => set((r) => void r.education.splice(i, 1))}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Institution" value={e.institution} onChange={(v) => set((r) => void (r.education[i]!.institution = v))} />
                <Field label="Degree" value={e.studyType} onChange={(v) => set((r) => void (r.education[i]!.studyType = v))} placeholder="B.Tech, MBA, BSc" />
                <Field label="Field" value={e.area} onChange={(v) => set((r) => void (r.education[i]!.area = v))} />
                <Field label="Year" value={e.endDate} onChange={(v) => set((r) => void (r.education[i]!.endDate = v))} />
              </div>
            </Entry>
          ))}
        </div>
      </Card>

      <Card
        title="Projects"
        actions={<Button onClick={() => set((r) => void r.projects.push({ id: newId("proj"), name: "", highlights: [] } as Project))}>Add</Button>}
      >
        <div className="flex flex-col">
          {profile.projects.length === 0 ? <p className="text-muted text-sm">Optional.</p> : null}
          {profile.projects.map((p, i) => (
            <Entry key={p.id} onRemove={() => set((r) => void r.projects.splice(i, 1))}>
              <Field label="Name" value={p.name} onChange={(v) => set((r) => void (r.projects[i]!.name = v))} />
              <Area label="Description" value={p.description} onChange={(v) => set((r) => void (r.projects[i]!.description = v))} />
              <Lines label="Highlights (one per line)" value={p.highlights} onChange={(v) => set((r) => void (r.projects[i]!.highlights = v))} />
            </Entry>
          ))}
        </div>
      </Card>

      <Card title="Certifications">
        <Lines label="One per line" value={profile.certificates} onChange={(v) => set((r) => void (r.certificates = v))} />
      </Card>
    </div>
  );
}

/** A record in the drawer: hung from a hairline, never a box inside a box. */
function Entry({ children, onRemove, onUp }: { children: React.ReactNode; onRemove: () => void; onUp?: () => void }) {
  return (
    <div className="border-rule border-b py-4 first:pt-0 last:border-b-0">
      <div className="flex flex-col gap-3">{children}</div>
      <div className="mt-3 flex justify-end gap-1">
        {onUp ? (
          <Button variant="ghost" onClick={onUp}>
            Move up
          </Button>
        ) : null}
        <Button variant="danger" onClick={onRemove}>
          Remove
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="field-label">{label}</span>
      <input className="field" type={type} value={value ?? ""} placeholder={placeholder} autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** Textarea; with commitOnBlur the parent only sees the value when focus leaves (used for comma lists). */
function Area({ label, value, onChange, className = "", commitOnBlur }: { label: string; value?: string; onChange: (v: string) => void; className?: string; commitOnBlur?: boolean }) {
  const [local, setLocal] = useState<string | null>(null);
  return (
    <label className={`flex flex-col gap-1 text-sm ${className}`}>
      <span className="field-label">{label}</span>
      <textarea
        className="field min-h-20 resize-y"
        value={local ?? value ?? ""}
        onChange={(e) => (commitOnBlur ? setLocal(e.target.value) : onChange(e.target.value))}
        onBlur={() => {
          if (local !== null) onChange(local);
          setLocal(null);
        }}
      />
    </label>
  );
}

function Lines({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  const [local, setLocal] = useState<string | null>(null);
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="field-label">{label}</span>
      <textarea
        className="field min-h-28 resize-y"
        value={local ?? value.join("\n")}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          if (local !== null) onChange(local.split("\n").map((l) => l.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean));
          setLocal(null);
        }}
      />
    </label>
  );
}
