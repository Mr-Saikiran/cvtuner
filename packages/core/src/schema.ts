import { z } from "zod";

/** Subset of the JSON Resume schema (https://jsonresume.org/schema) used by CVTuner. */
export const WorkSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  position: z.string().default(""),
  location: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  summary: z.string().optional(),
  highlights: z.array(z.string()).default([]),
});

export const EducationSchema = z.object({
  id: z.string(),
  institution: z.string().default(""),
  area: z.string().optional(),
  studyType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  score: z.string().optional(),
  /** extra line, e.g. "Evaluated by World Education Services" */
  note: z.string().optional(),
});

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  description: z.string().optional(),
  highlights: z.array(z.string()).default([]),
  url: z.string().optional(),
});

export const SkillGroupSchema = z.object({
  id: z.string(),
  name: z.string().default("Skills"),
  keywords: z.array(z.string()).default([]),
});

/** A section the user adds: Achievements, Declaration, Volunteering, Publications… */
export const CustomSectionSchema = z.object({
  id: z.string(),
  title: z.string().default("Section"),
  kind: z.enum(["list", "text"]).default("list"),
  items: z.array(z.string()).default([]),
  text: z.string().optional(),
  /** "side" goes to the sidebar in sidebar templates; single-column templates show it in the flow */
  placement: z.enum(["main", "side"]).default("main"),
});

/** Built-in sections, in their default order. */
export const BUILTIN_SECTIONS = [
  { id: "summary", label: "Summary" },
  { id: "skills", label: "Skills" },
  { id: "experience", label: "Experience" },
  { id: "projects", label: "Projects" },
  { id: "education", label: "Education" },
  { id: "certifications", label: "Certifications" },
  { id: "languages", label: "Languages" },
] as const;

export const ResumeSchema = z.object({
  basics: z.object({
    name: z.string().default(""),
    label: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    url: z.string().optional(),
    location: z.string().optional(),
    summary: z.string().optional(),
    /** small profile photo as a data: URL, used only by photo templates */
    image: z.string().optional(),
  }),
  work: z.array(WorkSchema).default([]),
  education: z.array(EducationSchema).default([]),
  projects: z.array(ProjectSchema).default([]),
  skills: z.array(SkillGroupSchema).default([]),
  certificates: z.array(z.string()).default([]),
  /** spoken languages, e.g. "English (fluent)" */
  languages: z.array(z.string()).default([]),
  custom: z.array(CustomSectionSchema).default([]),
  /** section order and visibility; ids are built-in ids or custom section ids */
  layout: z.object({ order: z.array(z.string()).default([]), hidden: z.array(z.string()).default([]) }).default({ order: [], hidden: [] }),
});

export type Work = z.infer<typeof WorkSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type SkillGroup = z.infer<typeof SkillGroupSchema>;
export type Resume = z.infer<typeof ResumeSchema>;
export type CustomSection = z.infer<typeof CustomSectionSchema>;

/** All section ids in display order: the saved order first, then anything new. */
export function sectionOrder(r: Resume): string[] {
  const all = [...BUILTIN_SECTIONS.map((b) => b.id as string), ...r.custom.map((c) => c.id)];
  const saved = r.layout.order.filter((id) => all.includes(id));
  return [...saved, ...all.filter((id) => !saved.includes(id))];
}

export function isHidden(r: Resume, id: string): boolean {
  return r.layout.hidden.includes(id);
}

export function sectionTitle(r: Resume, id: string): string {
  return r.custom.find((c) => c.id === id)?.title ?? BUILTIN_SECTIONS.find((b) => b.id === id)?.label ?? id;
}

let counter = 0;
export function newId(prefix = "id"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export function emptyResume(): Resume {
  return ResumeSchema.parse({ basics: { name: "" } });
}

/** Lenient parse: fills defaults and generates missing ids. */
export function parseResume(input: unknown): Resume {
  const raw = (input ?? {}) as Record<string, unknown>;
  const withIds = (list: unknown, prefix: string) =>
    Array.isArray(list)
      ? list.map((item) => ({ id: newId(prefix), ...(item as object) }))
      : [];
  return ResumeSchema.parse({
    ...raw,
    basics: raw.basics ?? { name: "" },
    work: withIds(raw.work, "work"),
    education: withIds(raw.education, "edu"),
    projects: withIds(raw.projects, "proj"),
    skills: withIds(raw.skills, "skill"),
    custom: withIds(raw.custom, "sec"),
  });
}

export function allSkills(resume: Resume): string[] {
  return resume.skills.flatMap((g) => g.keywords);
}

/** All free text in the resume, used for coverage matching. */
export function resumeText(resume: Resume): string {
  return [
    resume.basics.label,
    resume.basics.summary,
    ...resume.work.flatMap((w) => [w.position, w.summary, ...w.highlights]),
    ...resume.projects.flatMap((p) => [p.name, p.description, ...p.highlights]),
    ...resume.education.flatMap((e) => [e.area, e.studyType]),
    ...allSkills(resume),
    ...resume.certificates,
    ...resume.custom.flatMap((c) => [c.title, ...c.items, c.text]),
  ]
    .filter(Boolean)
    .join("\n");
}
