"use client";

import { emptyResume, isHidden, newId, parseResumeText, sampleResume, sectionOrder, sectionTitle, type CustomSection, type Education, type Project, type Resume } from "@cvtuner/core";
import { useEffect, useRef, useState } from "react";
import { downloadBlob } from "@/lib/files";
import { Button, Card } from "./ui";

interface Props {
  profile: Resume;
  setProfile: (r: Resume | ((p: Resume) => Resume)) => void;
  onNext: (tab: "tune" | "jobs") => void;
}

export function ProfileView({ profile, setProfile, onNext }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  // edits go to a draft; "Save profile" commits it to this browser's storage
  const [draft, setDraft] = useState<Resume>(profile);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);
  const last = useRef(profile);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    // the saved profile changed outside this view (first load from storage): follow it unless editing
    if (profile !== last.current) {
      last.current = profile;
      setDraft((d) => (JSON.stringify(d) === JSON.stringify(emptyResume()) || !dirtyRef.current ? profile : d));
    }
  }, [profile]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const save = () => {
    last.current = draft;
    setProfile(draft);
    setSavedAt(Date.now());
  };
  const ready = !!(draft.basics.name && (draft.work.length || draft.skills.some((g) => g.keywords.length)));
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
      setDraft(data.resume);
      setStatus(`Imported ${file.name}. Check each section below, then press Save profile. Automatic parsing is not perfect.`);
    } catch (e) {
      setStatus((e as Error).message);
    }
  };

  const set = (fn: (r: Resume) => void) =>
    setDraft((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });

  return (
    <div className="mx-auto grid max-w-5xl gap-6 pb-20">
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
            <Button variant="ghost" onClick={() => setDraft(sampleResume())}>
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
          Step 1: upload your resume, check it, and save it. This is the master copy: CVTuner never changes it when tuning, each job gets its own version. It is saved
          in this browser only, so use Export to keep a backup or move it to another device.
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
                  setDraft(parseResumeText(pasted));
                  setPasteOpen(false);
                  setPasted("");
                  setStatus("Imported pasted text. Check each section below, then press Save profile.");
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
            onClick={() => downloadBlob(new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" }), "cvtuner-draft.json")}
          >
            Export JSON
          </Button>
          <Button variant="danger" onClick={() => confirm("Clear your whole profile?") && setDraft(emptyResume())}>
            Clear profile
          </Button>
        </div>
      </Card>

      <SectionsCard draft={draft} set={set} />

      <Card title="Basics">
        <PhotoField image={draft.basics.image} onChange={(img) => set((r) => void (r.basics.image = img))} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" value={draft.basics.name} onChange={(v) => set((r) => void (r.basics.name = v))} autoComplete="name" />
          <Field label="Headline" value={draft.basics.label} onChange={(v) => set((r) => void (r.basics.label = v))} placeholder="e.g. Staff Nurse, Data Analyst" />
          <Field label="Email" value={draft.basics.email} onChange={(v) => set((r) => void (r.basics.email = v))} type="email" autoComplete="email" />
          <Field label="Phone" value={draft.basics.phone} onChange={(v) => set((r) => void (r.basics.phone = v))} type="tel" autoComplete="tel" />
          <Field label="Location" value={draft.basics.location} onChange={(v) => set((r) => void (r.basics.location = v))} autoComplete="address-level2" />
          <Field label="Website / LinkedIn" value={draft.basics.url} onChange={(v) => set((r) => void (r.basics.url = v))} type="url" autoComplete="url" />
        </div>
        <Area label="Summary" value={draft.basics.summary} onChange={(v) => set((r) => void (r.basics.summary = v))} className="mt-3" />
      </Card>

      <Card
        title="Experience"
        actions={<Button onClick={() => set((r) => void r.work.unshift({ id: newId("work"), name: "", position: "", highlights: [] }))}>Add role</Button>}
      >
        <div className="flex flex-col">
          {draft.work.length === 0 ? <p className="text-muted text-sm">No roles yet.</p> : null}
          {draft.work.map((w, i) => (
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

      <Card
        title="Skills"
        actions={<Button onClick={() => set((r) => void r.skills.push({ id: newId("skill"), name: r.skills.length ? "Tech Stack" : "Skills", keywords: [] }))}>Add skill group</Button>}
      >
        <div className="flex flex-col gap-4">
          {(draft.skills.length ? draft.skills : [{ id: "new", name: "Skills", keywords: [] }]).map((g, i) => (
            <div key={g.id} className="border-rule flex flex-col gap-2 border-b pb-4 last:border-b-0 last:pb-0">
              <div className="flex items-end gap-2">
                <div className="max-w-xs flex-1">
                  <Field
                    label="Group name"
                    value={g.name}
                    onChange={(v) =>
                      set((r) => {
                        if (!r.skills[i]) r.skills[i] = { id: newId("skill"), name: "Skills", keywords: [] };
                        r.skills[i]!.name = v;
                      })
                    }
                  />
                </div>
                {draft.skills.length > 1 ? (
                  <Button variant="danger" onClick={() => set((r) => void r.skills.splice(i, 1))}>
                    Remove group
                  </Button>
                ) : null}
              </div>
              <Area
                label="Comma separated"
                value={g.keywords.join(", ")}
                onChange={(v) =>
                  set((r) => {
                    if (!r.skills[i]) r.skills[i] = { id: newId("skill"), name: "Skills", keywords: [] };
                    r.skills[i]!.keywords = v.split(/,(?![^()]*\))\s*/).map((x) => x.trim()).filter(Boolean);
                  })
                }
                commitOnBlur
              />
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Education"
        actions={<Button onClick={() => set((r) => void r.education.push({ id: newId("edu"), institution: "" } as Education))}>Add</Button>}
      >
        <div className="flex flex-col">
          {draft.education.length === 0 ? <p className="text-muted text-sm">Nothing yet.</p> : null}
          {draft.education.map((e, i) => (
            <Entry key={e.id} onRemove={() => set((r) => void r.education.splice(i, 1))}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Institution" value={e.institution} onChange={(v) => set((r) => void (r.education[i]!.institution = v))} />
                <Field label="Degree" value={e.studyType} onChange={(v) => set((r) => void (r.education[i]!.studyType = v))} placeholder="B.Tech, MBA, BSc" />
                <Field label="Field" value={e.area} onChange={(v) => set((r) => void (r.education[i]!.area = v))} />
                <Field label="Year" value={e.endDate} onChange={(v) => set((r) => void (r.education[i]!.endDate = v))} />
                <Field label="Note (optional)" value={e.note} onChange={(v) => set((r) => void (r.education[i]!.note = v || undefined))} placeholder="e.g. Evaluated by WES" />
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
          {draft.projects.length === 0 ? <p className="text-muted text-sm">Optional.</p> : null}
          {draft.projects.map((p, i) => (
            <Entry key={p.id} onRemove={() => set((r) => void r.projects.splice(i, 1))}>
              <Field label="Name" value={p.name} onChange={(v) => set((r) => void (r.projects[i]!.name = v))} />
              <Area label="Description" value={p.description} onChange={(v) => set((r) => void (r.projects[i]!.description = v))} />
              <Lines label="Highlights (one per line)" value={p.highlights} onChange={(v) => set((r) => void (r.projects[i]!.highlights = v))} />
            </Entry>
          ))}
        </div>
      </Card>

      <Card title="Certifications">
        <Lines label="One per line" value={draft.certificates} onChange={(v) => set((r) => void (r.certificates = v))} />
      </Card>

      <Card title="Languages">
        <Lines label="One per line, e.g. English (fluent)" value={draft.languages} onChange={(v) => set((r) => void (r.languages = v))} />
      </Card>

      {draft.custom.map((c, i) => (
        <Card
          key={c.id}
          title={c.title || "Untitled section"}
          actions={
            <Button variant="danger" onClick={() => confirm(`Remove the “${c.title}” section?`) && set((r) => void removeCustom(r, c.id))}>
              Remove section
            </Button>
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Section title" value={c.title} onChange={(v) => set((r) => void (r.custom[i]!.title = v))} />
            <label className="flex flex-col gap-1">
              <span className="field-label">Content</span>
              <select className="field" value={c.kind} onChange={(e) => set((r) => void (r.custom[i]!.kind = e.target.value as CustomSection["kind"]))}>
                <option value="list">List, one item per line</option>
                <option value="text">Paragraph</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="field-label">Place in sidebar templates</span>
              <select className="field" value={c.placement} onChange={(e) => set((r) => void (r.custom[i]!.placement = e.target.value as CustomSection["placement"]))}>
                <option value="main">Main column</option>
                <option value="side">Sidebar</option>
              </select>
            </label>
          </div>
          <div className="mt-3">
            {c.kind === "list" ? (
              <Lines label="Items, one per line" value={c.items} onChange={(v) => set((r) => void (r.custom[i]!.items = v))} />
            ) : (
              <Area label="Text" value={c.text} onChange={(v) => set((r) => void (r.custom[i]!.text = v))} />
            )}
          </div>
        </Card>
      ))}
          {/* the save bar: always in reach, above the phone tab bar */}
      <div className="bg-plate fixed inset-x-0 bottom-[calc(48px+env(safe-area-inset-bottom))] z-[150] border-t-2 border-ink sm:bottom-0">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm" role="status">
            {dirty ? (
              <span className="text-warn font-medium">Unsaved changes</span>
            ) : savedAt ? (
              <>
                Saved in this browser at <span className="code">{new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </>
            ) : ready ? (
              <span className="text-muted">Profile saved in this browser</span>
            ) : (
              <span className="text-muted">Upload or fill in your resume, then save it</span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {dirty ? (
              <>
                <Button variant="ghost" onClick={() => setDraft(profile)}>
                  Discard
                </Button>
                <Button variant="primary" onClick={save}>
                  Save profile
                </Button>
              </>
            ) : ready ? (
              <>
                <Button onClick={() => onNext("tune")}>Tune for a job</Button>
                <Button variant="primary" onClick={() => onNext("jobs")}>
                  Find matching jobs
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>
</div>
  );
}

function removeCustom(r: Resume, id: string) {
  r.custom = r.custom.filter((c) => c.id !== id);
  r.layout.order = r.layout.order.filter((x) => x !== id);
  r.layout.hidden = r.layout.hidden.filter((x) => x !== id);
}

const SUGGESTED = ["Achievements", "Declaration", "Awards", "Volunteering", "Publications", "Interests", "References"];

/** Show, hide, reorder, add and remove the sections of the resume. Applies to PDF and Word. */
function SectionsCard({ draft, set }: { draft: Resume; set: (fn: (r: Resume) => void) => void }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<CustomSection["kind"]>("list");
  const [placement, setPlacement] = useState<CustomSection["placement"]>("main");
  const order = sectionOrder(draft);
  const move = (i: number, d: -1 | 1) =>
    set((r) => {
      const o = sectionOrder(r);
      const j = i + d;
      if (j < 0 || j >= o.length) return;
      [o[i], o[j]] = [o[j]!, o[i]!];
      r.layout.order = o;
    });
  const add = (name = title) => {
    const t = name.trim();
    if (!t) return;
    set((r) => {
      const id = newId("sec");
      r.custom.push({ id, title: t, kind: /declaration|summary|objective/i.test(t) ? "text" : kind, items: [], placement: /achievement|award|interest|hobb/i.test(t) ? "side" : placement });
      r.layout.order = [...sectionOrder(r).filter((x) => x !== id), id];
    });
    setTitle("");
  };
  return (
    <Card title="Sections">
      <p className="text-muted mb-3 max-w-[65ch] text-sm">
        Choose which sections appear in your resume and in what order. Hidden sections keep their content; they are just left out of the PDF and Word file.
      </p>
      <ol className="flex flex-col">
        {order.map((id, i) => {
          const hidden = isHidden(draft, id);
          const custom = draft.custom.some((c) => c.id === id);
          return (
            <li key={id} className={`border-rule flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-b-0 ${hidden ? "opacity-55" : ""}`}>
              <span className="flex items-center gap-3 text-sm">
                <span className="code text-muted w-5">{i + 1}</span>
                <span className="font-medium">{sectionTitle(draft, id)}</span>
                {custom ? <span className="text-muted text-xs">custom</span> : null}
                {hidden ? <span className="text-warn text-xs">hidden</span> : null}
              </span>
              <span className="flex flex-wrap gap-1">
                <Button variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${sectionTitle(draft, id)} up`}>
                  ↑
                </Button>
                <Button variant="ghost" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label={`Move ${sectionTitle(draft, id)} down`}>
                  ↓
                </Button>
                <Button
                  onClick={() =>
                    set((r) => {
                      r.layout.hidden = hidden ? r.layout.hidden.filter((x) => x !== id) : [...r.layout.hidden, id];
                    })
                  }
                >
                  {hidden ? "Show" : "Hide"}
                </Button>
                {custom ? (
                  <Button variant="danger" onClick={() => confirm(`Remove the “${sectionTitle(draft, id)}” section?`) && set((r) => void removeCustom(r, id))}>
                    Remove
                  </Button>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
      <form
        className="border-rule mt-4 grid gap-2 border-t pt-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Field label="New section" value={title} onChange={setTitle} placeholder="e.g. Achievements" />
        <label className="flex flex-col gap-1">
          <span className="field-label">Content</span>
          <select className="field" value={kind} onChange={(e) => setKind(e.target.value as CustomSection["kind"])}>
            <option value="list">List</option>
            <option value="text">Paragraph</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="field-label">In sidebar templates</span>
          <select className="field" value={placement} onChange={(e) => setPlacement(e.target.value as CustomSection["placement"])}>
            <option value="main">Main column</option>
            <option value="side">Sidebar</option>
          </select>
        </label>
        <Button type="submit" variant="primary" disabled={!title.trim()}>
          Add section
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUGGESTED.filter((t) => !draft.custom.some((c) => c.title.toLowerCase() === t.toLowerCase())).map((t) => (
          <button key={t} type="button" className="chip" onClick={() => add(t)}>
            <span className="code" aria-hidden>
              +
            </span>
            {t}
          </button>
        ))}
      </div>
    </Card>
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
        <div className="bg-paper-2 text-muted grid size-14 place-items-center rounded-full text-xs">Photo</div>
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
        <span className="text-muted text-xs">Optional. Used only by the photo templates, Clear and Balanced. Many countries prefer no photo.</span>
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
