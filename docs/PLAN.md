# CVTuner — JD-driven resume builder (techswitch.in/cvtuner)

Status: **Phase 0 and Phase 1 done** (see "Phase 1 notes" at the end). Phases 2–4 still to do.

## 1. Name

**CVTuner**, served at `techswitch.in/cvtuner` ("CVTuner by TechSwitch").

## 2. Goals

1. Any domain or technology: nursing, finance, sales, software, and so on. Nothing is hard-coded to tech.
2. Three ways to bring in a job: paste the JD into a box, paste a link from a job portal, or save a watched source that is checked on a schedule.
3. Two tailoring engines:
   - **AI mode:** bring your own key (Anthropic, OpenAI, Gemini, or a local model through Ollama or LM Studio).
   - **Rule mode (no AI):** a deterministic engine that pulls requirements out of the JD, frames basic sentences, and adds them to the resume in passive voice.
4. Output in **PDF and DOCX**, updated automatically for each job, with a version kept per job.
5. A **2-page target, 3-page hard cap**, enforced by the layout engine and not left to the user.
6. Web plus mobile, served under `techswitch.in/cvtuner`.

## 3. What Dossier lacks and what we do better

| Dossier (AienTech/dossier) | CVTuner |
|---|---|
| Desktop only | Mobile-first web (PWA) plus an Expo app for iOS and Android with share-sheet import |
| Single user, one password, one profile | Accounts, plus several base profiles per user (such as "Backend" and "Eng Manager") |
| PDF only | PDF **and** DOCX (ATS portals often want .docx) |
| AI needed for tailoring | Rule mode works fully offline with no key |
| No page-limit guarantee | Bullet-priority trimming keeps 2 pages, never more than 3 |
| Chat-based refinement | Side-by-side **diff** of base vs. tailored, accept/reject each line |
| Match score | ATS keyword coverage score plus a "missing skills" list you confirm or reject (never invented) |
| Heavy server (Chromium in process, 2 GB) | Typst-based PDF rendering (small and fast; also runs in WASM in the browser) |
| Self-host only | Hosted at techswitch.in/cvtuner; self-host stays possible |
| Gmail/agent tie-in | Kept as an optional later phase; first focus is resume quality |

## 4. User flows

1. **Onboard:** upload an existing resume (PDF, DOCX, or LinkedIn export), parse it into a JSON Resume profile, then review.
2. **Add a job** with one of:
   - a paste box (largest input, always available);
   - a URL field, fetched by the server (see 6);
   - mobile share sheet or browser extension: "Share to CVTuner" from any job page;
   - a watched source (a company's Greenhouse, Lever, or Ashby board, an RSS feed, or a forwarded job-alert email).
3. **Analyze:** requirements, keywords, seniority, and domain are extracted, and a coverage score is shown.
4. **Tailor:** choose AI or Rule mode, then review a diff, toggle lines, and edit inline.
5. **Export:** PDF and DOCX, named `Name_Company_Role.pdf`, stored in the job's history.
6. **Auto mode:** new postings from watched sources that match a profile get a tailored draft and a notification. Nothing is ever applied for automatically.

## 5. Tailoring engines

### 5.1 Rule mode (programmatic, no AI)
Pipeline, all in TypeScript in `packages/core` so web and mobile share it:

1. **Clean:** strip HTML and boilerplate (benefits, EEO text), then split into sections (Responsibilities, Requirements, Nice to have).
2. **Extract:**
   - Skills come from a domain-neutral taxonomy: **ESCO** (EU, about 13k skills across all occupations) plus **O\*NET** for US roles, with user-added terms on top.
   - Responsibility phrases come from verb-object chunks found with `compromise` (a small NLP library that works in RN and the browser), for example "manage vendor contracts" or "design REST APIs".
   - Weights: Requirements section > Responsibilities > Nice to have, then frequency and title words.
3. **Match** against the profile with exact, synonym, and stem matching. Each JD item is marked *covered*, *partially covered*, or *missing*.
4. **Frame sentences** from templates, filled per matched item and converted to passive voice:
   - JD: "Manage vendor contracts and reduce costs"
   - Active: "Managed vendor contracts and reduced costs"
   - **Passive (appended):** "Vendor contracts were managed and costs were reduced across <project/role>."
   - Passive conversion: find the verb-object chunk, change the verb to its past participle (compromise `verbs().toPastParticiple()` plus an irregular-verb table), then build `<Object> was/were <participle> [by/for/across <context>]`.
5. **Place:** each new line goes under the experience entry whose skills overlap most, or into a "Relevant Highlights" block.
6. **Truthfulness rule:** sentences are only made for items the profile covers, or that the user ticks "I have this". Missing items show as gaps. They are never added silently.

> Advice: recruiters and ATS tools usually rank action-verb bullets ("Managed X") higher than passive ones. Rule mode has a **Voice** toggle: Passive (as requested) or Action-verb. Both use the same pipeline.

### 5.2 AI mode (bring your own key)
- Adapters: Anthropic, OpenAI, Gemini, and OpenAI-compatible endpoints (Ollama, LM Studio, OpenRouter).
- Keys are kept on the device (Keychain or Keystore on mobile, encrypted IndexedDB on web), or encrypted on the server if the user opts in.
- The model returns **structured JSON patches** against the resume schema, not free text, so the diff, voice rules, and page limit still apply.
- The prompt only allows facts from the profile; gaps come back as a separate list.
- A cheap model is used for extraction and a stronger one for rewriting, both configurable.

## 6. Fetching from job portals (be careful here)

LinkedIn, Indeed, Naukri, and Glassdoor ban scraping in their terms and actively block bots. Plan:
1. **Official or public sources first:** Greenhouse, Lever, Ashby, SmartRecruiters, and Workable have public job board JSON APIs. Adzuna, JSearch (RapidAPI), and USAJobs have APIs with keys.
2. **Structured data:** many career pages include `schema.org/JobPosting` JSON-LD, which we read when the user pastes a URL.
3. **Readability fallback** for plain pages, when allowed (robots.txt is respected).
4. **Blocked portals:** the share sheet or browser extension copies the text the user is already viewing, then uses the paste flow. This is legal and reliable.

## 7. Page-limit and layout engine

- One layout model feeds both PDF and DOCX.
- PDF is rendered with **Typst** (server binary, or `typst.ts` WASM in the browser for live preview). The page count is exact.
- Trim loop: render, then while pages > 2, drop the lowest-priority bullet (scored by JD relevance × recency). Then tighten spacing and font size inside set limits (10–11pt). Stop at 2 pages, or at 3 if the user picked "allow 3". Pages over 3 are never produced.
- DOCX is made with the `docx` npm library from the same trimmed content, with the same fonts and margins, so its length matches the PDF.
- Templates are ATS-safe: single column by default, with no tables or images in the main text.

## 8. Architecture

```
cvtuner/                      (monorepo: pnpm + Turborepo)
├── apps/
│   ├── web/                  Next.js (App Router), basePath "/cvtuner", PWA
│   ├── mobile/               Expo (React Native), share-sheet intent, offline rule mode
│   └── extension/            (phase 3) Chrome/Firefox "Send to CVTuner"
├── packages/
│   ├── core/                 schema (JSON Resume + zod), JD parser, rule engine, passive-voice
│   ├── ai/                   provider adapters, prompts, JSON-patch validation
│   ├── render/               PDF (react-pdf) + DOCX builders, page-fit loop
│   ├── ui/                   shared components (Tamagui or NativeWind for web+native)
│   └── taxonomy/             ESCO/O*NET skill lists + synonyms (built JSON)
└── services/
    ├── api/                  Next.js route handlers or Hono: auth, jobs, versions
    └── worker/               scheduled fetch of watched sources, render queue
```

- **Data:** Postgres (Supabase or Neon) holding users, profiles, jobs, resume_versions (JSON plus a diff), and files (S3 or R2).
- **Auth:** email magic link plus Google sign-in.
- **Hosting at techswitch.in/cvtuner:** set Next.js `basePath: '/cvtuner'`, then route `/cvtuner/*` to the app with a Cloudflare Worker or Nginx `location /cvtuner/`. The rest of techswitch.in is untouched. Mobile deep links use `techswitch.in/cvtuner/j/<id>`.
- **Privacy:** rule mode runs fully on the device. A "local only" switch stores nothing on the server.

## 9. UI (web and mobile)

- **Home:** a large "Paste JD or link" box as the main action; recent jobs as cards with coverage %.
- **Job view:** three tabs on mobile, three panes on desktop:
  1. JD with highlighted keywords (green covered, amber partial, red missing);
  2. tailored resume with live preview and a page-count badge ("1.8 / 2 pages");
  3. changes (diff list with accept/reject, voice toggle, AI/Rule switch).
- **Profiles:** several base resumes; inline editing of sections.
- **Exports:** PDF/DOCX buttons, share sheet on mobile, version history per job.
- **Settings:** AI keys, default voice, page cap (2 or 3), template, language.
- Dark and light themes, WCAG AA, and usable one-handed on a phone.

## 10. Roadmap

| Phase | Scope | Output |
|---|---|---|
| **0. Setup** (1 week) | Monorepo, schema, CI, `/cvtuner` routing on techswitch.in | Empty app live at techswitch.in/cvtuner |
| **1. MVP web** (3–4 weeks) | Resume import, JD paste box, rule engine plus passive voice, Typst PDF plus DOCX, 2/3-page trim, diff UI | Rule mode works from start to finish |
| **2. AI and URLs** (2–3 weeks) | Bring-your-own-key adapters, URL fetch (JSON-LD, ATS APIs), coverage score, accounts and versions | Hosted beta |
| **3. Mobile and auto** (3–4 weeks) | Expo app, share-sheet import, watched sources plus worker, push notifications, browser extension | App store beta |
| **4. Extras** | Cover letter, application tracker, multiple languages, more templates | — |

## 11. Risks

- **Portal blocking or ToS:** handled by the APIs, JSON-LD, and share-sheet design in section 6.
- **Passive voice hurting results:** handled by the voice toggle, with Action-verb available.
- **Invented claims:** handled by the confirm-before-add rule and the AI JSON-patch checks.
- **PDF vs. DOCX length drift:** handled by shared metrics and a DOCX page estimate check; a warning shows if they differ.

## Phase 1 notes (what was built, and what changed from the plan)

- **PDF engine:** the plan named Typst. Phase 1 uses `@react-pdf/renderer`, which runs fully **in the browser**, so no PDF server is needed on Vercel. The page count is read from the generated PDF, so the 2/3-page check is still exact. Typst (WASM) can still be added later as a second template engine.
- **Fit order:** the resume is first made denser in three bounded steps (font 10.5→10pt, tighter spacing and margins). Only after that are the least relevant bullets dropped, found by binary search. At least one bullet is always kept per role. "Up to 3" skips trimming until content runs past 3 pages.
- **Skills taxonomy:** a curated cross-domain list (about 500 terms and aliases across software, cloud, data, product, marketing/sales, finance, operations, HR, healthcare, legal, education and engineering). On top of it, acronyms and product names found in the JD (like "Coupa" or "HL7") are detected automatically. ESCO/O*NET import is planned for Phase 2.
- **Storage:** profile, saved versions and settings live in the browser (localStorage). Accounts and Postgres come in Phase 2.
- **Job link field:** shown in the UI but turned off, labelled Phase 2.
