import { findTerms } from "./jd";
import { allSkills, newId, resumeText, type Resume } from "./schema";
import type { Suggestion, TailorResult } from "./tailor";
import { buildIndex } from "./taxonomy";
import { containsTerm } from "./text";
import type { Voice } from "./voice";

export type ProviderId =
  | "anthropic"
  | "openai"
  | "gemini"
  | "groq"
  | "openrouter"
  | "mistral"
  | "cerebras"
  | "deepseek"
  | "xai"
  | "custom";

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  /** OpenAI-compatible chat completions base URL (unused for anthropic) */
  baseUrl: string;
  /** suggested model; the UI can load the live list from the provider */
  defaultModel: string;
  free: "yes" | "some-models" | "no";
  keyUrl: string;
  note?: string;
  /** called straight from the browser instead of through the CVTuner server (local models) */
  direct?: boolean;
}

export const PROVIDERS: ProviderInfo[] = [
  { id: "gemini", name: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", defaultModel: "gemini-2.5-flash", free: "yes", keyUrl: "https://aistudio.google.com/apikey", note: "Free tier with daily limits." },
  { id: "groq", name: "Groq", baseUrl: "https://api.groq.com/openai/v1", defaultModel: "llama-3.3-70b-versatile", free: "yes", keyUrl: "https://console.groq.com/keys", note: "Free tier, very fast open models." },
  { id: "openrouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "meta-llama/llama-3.3-70b-instruct:free", free: "some-models", keyUrl: "https://openrouter.ai/keys", note: "One key for hundreds of models; ids ending in :free cost nothing." },
  { id: "mistral", name: "Mistral", baseUrl: "https://api.mistral.ai/v1", defaultModel: "mistral-small-latest", free: "yes", keyUrl: "https://console.mistral.ai/api-keys", note: "Free Experiment plan." },
  { id: "cerebras", name: "Cerebras", baseUrl: "https://api.cerebras.ai/v1", defaultModel: "llama-3.3-70b", free: "yes", keyUrl: "https://cloud.cerebras.ai", note: "Free tier." },
  { id: "anthropic", name: "Anthropic Claude", baseUrl: "https://api.anthropic.com", defaultModel: "claude-opus-5-5", free: "no", keyUrl: "https://console.anthropic.com/settings/keys" },
  { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4.1-mini", free: "no", keyUrl: "https://platform.openai.com/api-keys" },
  { id: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", defaultModel: "deepseek-chat", free: "no", keyUrl: "https://platform.deepseek.com/api_keys", note: "Low cost." },
  { id: "xai", name: "xAI Grok", baseUrl: "https://api.x.ai/v1", defaultModel: "grok-3-mini", free: "no", keyUrl: "https://console.x.ai" },
  { id: "custom", name: "Local / custom (OpenAI-compatible)", baseUrl: "http://localhost:11434/v1", defaultModel: "llama3.1", free: "yes", keyUrl: "https://ollama.com", note: "Ollama, LM Studio or any OpenAI-compatible server. Runs from your browser, so localhost works.", direct: true },
];

export const providerInfo = (id: ProviderId) => PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0]!;

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

// ---------- tailoring ----------

export interface AiTailorInput {
  resume: Resume;
  jd: string;
  voice: Voice;
  confirmedSkills: string[];
  /** missing JD keywords the user has NOT confirmed — the model must not claim them */
  gaps: string[];
  language: string;
  maxBullets?: number;
  /** "auto": the model may confirm missing JD skills it can prove from the resume */
  skillConfirm?: "manual" | "auto";
  /** ask for [X%]-style placeholders where a bullet lacks a measurable result */
  suggestMetrics?: boolean;
}

/** Compact, id-carrying view of the resume so the model can point bullets at the right role. */
function resumeForPrompt(r: Resume) {
  return {
    headline: r.basics.label,
    summary: r.basics.summary,
    roles: [
      ...r.work.map((w) => ({ id: w.id, title: w.position, company: w.name, dates: [w.startDate, w.endDate].filter(Boolean).join(" – "), bullets: w.highlights })),
      ...r.projects.map((p) => ({ id: p.id, title: p.name, company: "Project", bullets: p.highlights })),
    ],
    skills: allSkills(r),
    education: r.education.map((e) => [e.studyType, e.area, e.institution].filter(Boolean).join(", ")),
    certifications: r.certificates,
  };
}

export function buildTailorPrompt(input: AiTailorInput): ChatMessage[] {
  const voiceRule =
    input.voice === "passive"
      ? 'Write every new bullet in PASSIVE voice with no personal pronouns, e.g. "Vendor contracts were managed and costs were reduced by 9%."'
      : 'Write every new bullet starting with a strong past-tense action verb and no pronouns, e.g. "Managed vendor contracts and cut costs by 9%."';
  const system = `You tailor resumes to job descriptions for any profession. You are strict about truth.

Rules:
- Use ONLY facts present in the candidate's resume or in the confirmed skills list. Never invent employers, job titles, dates, degrees, numbers, tools, certifications or achievements.
- Never mention any of these skills, which the candidate has not confirmed${input.skillConfirm === "auto" ? " (unless you list it in inferredSkills with proof)" : ""}: ${input.gaps.length ? input.gaps.join(", ") : "(none)"}.
- Each new bullet must restate or reframe something the resume already shows, using the job description's wording where it is honestly true.
- ${voiceRule}
- Bullets: one sentence each, at most 30 words, no markdown.
- Add at most ${input.maxBullets ?? 6} new bullets in total, at most 3 per role. Do not repeat bullets that already exist.
- Write in this language: ${input.language}.
- Keep every number, percentage, amount and duration from the original resume lines; quantified results make a resume stand out.${
    input.suggestMetrics
      ? `
- Where a new bullet has no measurable result in the resume, add a placeholder the candidate will fill in, such as "by [X%]", "for [N] clients" or "saving [₹X]". Never make up an actual number.`
      : ""
  }${
    input.skillConfirm === "auto"
      ? `
- For each of these missing job skills, decide whether the resume clearly proves it: ${input.gaps.join(", ") || "(none)"}. Only include a skill in "inferredSkills" when you can quote the exact resume line that proves it.`
      : ""
  }
- Reply with JSON only, no prose and no code fences, in exactly this shape:
{"bullets":[{"roleId":"<id of the role from the resume>","text":"<new bullet>","jdSource":"<short quote from the JD it answers>"}],"summary":"<2-3 sentence professional summary for this job, or empty string>","skillsOrder":["<existing or confirmed skills, most relevant to this job first>"],"jobTitle":"<job title from the JD>","company":"<company from the JD or empty>"${input.skillConfirm === "auto" ? ',"inferredSkills":[{"skill":"<missing job skill>","evidence":"<exact quote from the resume>"}]' : ""}}`;
  const user = `CANDIDATE RESUME (JSON):
${JSON.stringify(resumeForPrompt(input.resume))}

CONFIRMED EXTRA SKILLS: ${input.confirmedSkills.join(", ") || "(none)"}

JOB DESCRIPTION:
${input.jd.slice(0, 15000)}`;
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

/** Pulls the first JSON object out of a model reply (tolerates code fences and chatter). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("The model did not return JSON.");
  return JSON.parse(fenced.slice(start, end + 1));
}

export interface AiTailorOutcome {
  suggestions: Suggestion[];
  /** lines we dropped because they claimed something the profile does not support */
  rejected: { text: string; reason: string }[];
  /** missing skills the model proved from a quoted resume line (auto mode only) */
  inferred: { skill: string; evidence: string }[];
  jobTitle?: string;
  company?: string;
}

/**
 * Turns the model's JSON into the same Suggestion list the rule engine produces, and enforces
 * the truth rules in code — the prompt asks nicely, this makes sure.
 */
export function validateAiTailor(raw: unknown, input: AiTailorInput, rule: TailorResult): AiTailorOutcome {
  const data = (raw ?? {}) as {
    bullets?: { roleId?: string; text?: string; jdSource?: string }[];
    summary?: string;
    skillsOrder?: string[];
    jobTitle?: string;
    company?: string;
    inferredSkills?: { skill?: string; evidence?: string }[];
  };
  const { resume } = input;
  const roles = new Map<string, string>([
    ...resume.work.map((w) => [w.id, [w.position, w.name].filter(Boolean).join(" · ")] as [string, string]),
    ...resume.projects.map((p) => [p.id, p.name || "Project"] as [string, string]),
  ]);
  const text = resumeText(resume);
  // auto mode: accept an inferred skill only if its quoted evidence really is in the resume
  const inferred: AiTailorOutcome["inferred"] = [];
  if (input.skillConfirm === "auto") {
    const lines = text.split("\n").map((l) => l.toLowerCase());
    const gapSet = new Map(input.gaps.map((g) => [g.toLowerCase(), g]));
    for (const i of data.inferredSkills ?? []) {
      const skill = gapSet.get(String(i.skill ?? "").toLowerCase());
      const ev = String(i.evidence ?? "").toLowerCase().replace(/[.…"]+$/g, "").trim();
      if (skill && ev.length >= 12 && lines.some((l) => l.includes(ev) || (ev.length > 30 && l.includes(ev.slice(0, 30))))) {
        inferred.push({ skill, evidence: String(i.evidence).trim() });
      }
    }
  }
  const confirmed = new Set([...input.confirmedSkills, ...inferred.map((i) => i.skill)].map((s) => s.toLowerCase()));
  const index = buildIndex(allSkills(resume));
  // a skill counts as present if the resume mentions it under any alias ("vendor contracts" → Vendor Management)
  const profileTerms = new Set(findTerms(text, index).map((t) => t.toLowerCase()));
  const has = (term: string) => profileTerms.has(term.toLowerCase()) || containsTerm(text, term) || confirmed.has(term.toLowerCase());
  const gaps = input.gaps.filter((g) => !confirmed.has(g.toLowerCase()));
  const existing = new Set([...resume.work, ...resume.projects].flatMap((e) => e.highlights.map((h) => h.trim().toLowerCase())));

  const rejected: AiTailorOutcome["rejected"] = [];
  const suggestions: Suggestion[] = [];
  const perRole = new Map<string, number>();

  // a claim is unsupported when it names a known skill the profile lacks, or a JD gap
  const unsupported = (line: string) =>
    gaps.find((g) => containsTerm(line, g)) ?? findTerms(line, index).find((t) => !has(t));

  for (const b of data.bullets ?? []) {
    const line = (b.text ?? "").replace(/\s+/g, " ").trim();
    if (!line) continue;
    const roleId = b.roleId && roles.has(b.roleId) ? b.roleId : [...roles.keys()][0];
    if (!roleId) continue;
    const bad = unsupported(line);
    if (bad) {
      rejected.push({ text: line, reason: `mentions ${bad}, which is not in your profile` });
      continue;
    }
    if (existing.has(line.toLowerCase())) continue;
    if ((perRole.get(roleId) ?? 0) >= 3 || suggestions.length >= (input.maxBullets ?? 6)) continue;
    perRole.set(roleId, (perRole.get(roleId) ?? 0) + 1);
    suggestions.push({
      id: newId("sug"),
      kind: "add-bullet",
      targetId: roleId,
      targetLabel: roles.get(roleId)!,
      text: /[.!?]$/.test(line) ? line : `${line}.`,
      source: (b.jdSource ?? "").trim() || "AI suggestion",
      keywords: rule.keywords.filter((k) => containsTerm(line, k.name)).map((k) => k.name),
      accepted: true,
    });
  }

  const toAdd = [...new Set([...(rule.suggestions.find((s) => s.kind === "add-skills")?.skills ?? []), ...inferred.map((i) => i.skill)])];
  if (toAdd.length) suggestions.push({ id: newId("sug"), kind: "add-skills", skills: toAdd, accepted: true });

  const current = allSkills(resume);
  const allowed = new Map([...current, ...input.confirmedSkills, ...inferred.map((i) => i.skill)].map((s) => [s.toLowerCase(), s]));
  const order = (data.skillsOrder ?? []).map((s) => allowed.get(String(s).toLowerCase())).filter((s): s is string => !!s);
  // skills the JD asks for always lead, in JD priority order
  const jdFirst = rule.keywords.map((k) => allowed.get(k.name.toLowerCase())).filter((s): s is string => !!s && current.includes(s));
  const fullOrder = [...new Set([...jdFirst, ...order, ...current])];
  if (fullOrder.join("|") !== current.join("|")) {
    suggestions.push({ id: newId("sug"), kind: "reorder-skills", order: fullOrder, accepted: true });
  }

  const summary = (data.summary ?? "").trim();
  if (summary) {
    const bad = unsupported(summary);
    if (bad) rejected.push({ text: summary, reason: `mentions ${bad}, which is not in your profile` });
    else suggestions.push({ id: newId("sug"), kind: "summary", text: summary, accepted: true, replace: true });
  }

  return { suggestions, rejected, inferred, jobTitle: data.jobTitle?.trim() || undefined, company: data.company?.trim() || undefined };
}

// ---------- cover letter ----------

export interface CoverLetterInput {
  resume: Resume;
  jd: string;
  jobTitle?: string;
  company?: string;
  gaps: string[];
  language: string;
  tone: "formal" | "friendly";
}

export function buildCoverLetterPrompt(input: CoverLetterInput): ChatMessage[] {
  return [
    {
      role: "system",
      content: `You write short, specific cover letters for any profession.
Rules:
- 3 short paragraphs, 180-260 words total, ${input.tone} tone, written in ${input.language}.
- Use only facts from the candidate's resume. Never invent numbers, employers, tools or skills.
- Do not claim these skills: ${input.gaps.join(", ") || "(none)"}.
- No greeting line, no sign-off, no placeholders like [Company] — just the body paragraphs separated by blank lines.`,
    },
    {
      role: "user",
      content: `RESUME (JSON):\n${JSON.stringify(resumeForPrompt(input.resume))}\n\nROLE: ${input.jobTitle ?? "(see JD)"} at ${input.company ?? "(see JD)"}\n\nJOB DESCRIPTION:\n${input.jd.slice(0, 12000)}`,
    },
  ];
}
