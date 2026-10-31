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
      setStatus(`Imported ${file.name}. Check each section below — automatic parsing is not perfect.`);
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
    <div className="mx-auto grid max-w-4xl gap-4">
      <Card
        title="Your base resume"
        actions={
          <>
            <Button variant="primary" onClick={() => fileRef.current?.click()}>
              Upload PDF / Word
            </Button>
            <Button onClick={() => setPasteOpen((v) => !v)}>Paste text</Button>
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
        <p className="muted text-sm">
          This is the master copy. CVTuner never changes it when tuning — each job gets its own version.
        </p>
        {status ? <p className="mt-2 text-sm" role="status">{status}</p> : null}
        {pasteOpen ? (
          <div className="mt-3 flex flex-col gap-2">
            <textarea className="field min-h-48 font-mono text-[13px]" placeholder="Paste your resume as plain text" value={pasted} onChange={(e) => setPasted(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button
                variant="primary"
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
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => downloadBlob(new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" }), "cvtuner-profile.json")}>
            Export JSON
          </Button>
          <Button variant="danger" onClick={() => confirm("Clear your whole profile?") && setProfile(emptyResume())}>
            Clear
          </Button>
        </div>
      </Card>

      <Card title="Basics">
        <PhotoField image={profile.basics.image} onChange={(img) => set((r) => void (r.basics.image = img))} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" value={profile.basics.name} onChange={(v) => set((r) => void (r.basics.name = v))} />
          <Field label="Headline" value={profile.basics.label} onChange={(v) => set((r) => void (r.basics.label = v))} placeholder="e.g. Staff Nurse, Data Analyst" />
          <Field label="Email" value={profile.basics.email} onChange={(v) => set((r) => void (r.basics.email = v))} type="email" />
          <Field label="Phone" value={profile.basics.phone} onChange={(v) => set((r) => void (r.basics.phone = v))} type="tel" />
          <Field label="Location" value={profile.basics.location} onChange={(v) => set((r) => void (r.basics.location = v))} />
          <Field label="Website / LinkedIn" value={profile.basics.url} onChange={(v) => set((r) => void (r.basics.url = v))} />
        </div>
        <Area label="Summary" value={profile.basics.summary} onChange={(v) => set((r) => void (r.basics.summary = v))} className="mt-3" />
      </Card>

      <Card
        title="Experience"
        actions={
          <Button onClick={() => set((r) => void r.work.unshift({ id: newId("work"), name: "", position: "", highlights: [] }))}>+ Add role</Button>
        }
      >
        <div className="flex flex-col gap-4">
          {profile.work.length === 0 ? <p className="muted text-sm">No roles yet.</p> : null}
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
        actions={<Button onClick={() => set((r) => void r.education.push({ id: newId("edu"), institution: "" } as Education))}>+ Add</Button>}
      >
        <div className="flex flex-col gap-4">
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
        actions={<Button onClick={() => set((r) => void r.projects.push({ id: newId("proj"), name: "", highlights: [] } as Project))}>+ Add</Button>}
      >
        <div className="flex flex-col gap-4">
          {profile.projects.length === 0 ? <p className="muted text-sm">Optional.</p> : null}
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

      <Card title="Languages">
        <Lines label="One per line, e.g. English (fluent)" value={profile.languages} onChange={(v) => set((r) => void (r.languages = v))} />
      </Card>
    </div>
  );
}

/** Square-cropped, downscaled JPEG so the photo stays small in storage and in the PDF. */
async function toAvatar(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  canvas.getContext("2d")!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 256, 256);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function PhotoField({ image, onChange }: { image?: string; onChange: (v: string | undefined) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="mb-3 flex items-center gap-3">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="Profile photo" className="size-14 rounded-full object-cover" />
      ) : (
        <div className="grid size-14 place-items-center rounded-full bg-black/5 text-xs muted dark:bg-white/10">Photo</div>
      )}
      <div className="flex flex-col gap-1">
        <div className="flex gap-2">
          <Button onClick={() => ref.current?.click()}>{image ? "Change photo" : "Add photo"}</Button>
          {image ? (
            <Button variant="danger" onClick={() => onChange(undefined)}>
              Remove
            </Button>
          ) : null}
        </div>
        <span className="muted text-xs">Optional. Used only by photo templates (Clear, Balanced). Many countries prefer no photo.</span>
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) onChange(await toAvatar(f));
          e.target.value = "";
        }}
      />
    </div>
  );
}

function Entry({ children, onRemove, onUp }: { children: React.ReactNode; onRemove: () => void; onUp?: () => void }) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-3 sm:p-4">
      <div className="flex flex-col gap-3">{children}</div>
      <div className="mt-2 flex justify-end gap-1">
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

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value?: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="muted text-xs font-medium">{label}</span>
      <input className="field" type={type} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** Textarea; with commitOnBlur the parent only sees the value when focus leaves (used for comma lists). */
function Area({ label, value, onChange, className = "", commitOnBlur }: { label: string; value?: string; onChange: (v: string) => void; className?: string; commitOnBlur?: boolean }) {
  const [local, setLocal] = useState<string | null>(null);
  return (
    <label className={`flex flex-col gap-1 text-sm ${className}`}>
      <span className="muted text-xs font-medium">{label}</span>
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
      <span className="muted text-xs font-medium">{label}</span>
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

