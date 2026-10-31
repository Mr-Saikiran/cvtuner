# CVTuner

Tune your resume to any job description, in any field. Exports **PDF and Word**, always fitted to **2 pages (3 at most)**.
Live at **[techswitch.in/cvtuner](https://techswitch.in/cvtuner)**.

## For job seekers
- **Bring in a job three ways.** Paste the description, paste a link, or share it from your phone or the browser extension. Links from Greenhouse, Lever, Ashby, SmartRecruiters, Workable and most career pages (schema.org JobPosting) are fetched for you. For LinkedIn, Indeed and Naukri, which forbid automated access, CVTuner asks you to paste instead.
- **Match and ATS check.** Each keyword is marked as in your resume or missing. An ATS readiness score covers keywords, job title, contact details, standard sections, dates, quantified results, bullet length, page count and layout.
- **Confirming skills.** In Manual mode you tap each missing skill you really have. In Auto mode, CVTuner confirms only skills that a line of your resume proves; with AI, the model has to quote that line. Confirmed and job-relevant skills go to the top of your Skills section.
- **Two engines.**
  - The **rule engine** works offline with no key. It writes sentences from the job's duties in passive voice or with action verbs.
  - **AI** uses your own key. Providers with free tiers: Gemini, Groq, OpenRouter (`:free` models), Mistral and Cerebras. Paid: Anthropic, OpenAI, DeepSeek and xAI. Local models work too, through Ollama, LM Studio or any OpenAI-compatible server.
  - Everything the AI writes passes a truth check in code: lines that claim skills you don't have are removed.
- **Metrics.** Numbers, percentages and amounts in your bullets are set in bold. AI keeps your real numbers and leaves placeholders like `[X%]` where a line has none. It never makes up figures, and the ATS check reminds you to fill the placeholders in.
- **Import that understands designed resumes.** PDFs are rebuilt from text positions: sidebars are separated from the main column, letter-spaced titles rejoined, wrapped bullets merged. Date-first roles ("Jan 2022 – Present / Company | Clients – … / Title"), several skill groups (Skills, Tech Stack), multi-line education, and extra sections (Achievements, Declaration, Interests…) are recognised.
- **Sections you control.** Show, hide, reorder, add and remove sections in Profile → Sections. Custom sections can be a list or a paragraph and can go in the main column or the sidebar.
- **9 templates.** Four are ATS-safe single column: Simple, Modern, Corporate, Precision. Five are designed: Header band, Clear (photo and sidebar), Balanced (dark sidebar and photo), Two column, and Spectrum (gradient sidebar and header, experience timeline). The Word export of every template is single column.
- **Cover letter** from the rule engine or AI, exported as PDF or Word.
- **Document languages:** English, Spanish, French, German, Portuguese, Italian and Dutch.
- **Profile comes first.** Upload or paste your resume, check it, then press **Save profile**. It is saved in this browser; use Export for a backup. From there, go to **Find matching jobs** or **Tune for a job**.
- **Jobs tab, searched automatically.** When you're online, CVTuner searches for your headline and city on its own, at most every 6 hours, and ranks each job by how well it matches your profile.
  - **No-key sources:** Remotive and Jobicy (remote roles).
  - **Free key, JSearch (RapidAPI):** LinkedIn, Indeed, Naukri and Glassdoor listings, legally, through Google for Jobs.
  - **Free key, Adzuna:** local jobs in India and 15 more countries.
  - **LinkedIn, Naukri, Indeed and Google Jobs buttons** open those sites' own search, pre-filled. They don't allow apps to read their pages, so send a job back with Share or the extension.
- **LinkedIn, Naukri and Indeed integration** through the CVTuner browser extension (download it from the Jobs tab). Every job page on those sites gets **Tune with CVTuner** and **Save to tracker** buttons. They bring in the title, company, location, full description and (Naukri) key skills from the page you are viewing, in your own browser. Those sites don't allow servers to read their pages, so this is the way that works and stays within their rules.
- **Watched company boards** (Greenhouse, Lever, Ashby, SmartRecruiters, Workable) with alerts for new matches.
- **Tracker.** Saved versions are also an application tracker: status, applied date, notes and a funnel.

## For recruiters
- **Screen tab.** A lightweight ATS: upload many resumes (PDF, Word or text), paste one job description, optionally set must-have skills, and get a ranked list with matched and missing skills, a shortlist and CSV export. Resumes stay in the browser tab.

## Privacy
Profile, versions, boards and API keys are stored in your browser only. When you use a cloud AI provider, the request goes through `/cvtuner/api/ai`, which forwards it with your key and stores nothing. Local models are called straight from the browser.

## Layout
```
apps/web          Next.js app (basePath /cvtuner): UI, /api/import, /api/job, /api/ai
apps/extension    Chrome/Edge MV3 extension "Send to CVTuner"
packages/core     schema, JD parser, taxonomy, voice engine, tailoring, AI prompts and truth check,
                  job-source parsers, ATS report, screening, cover letter, metrics, i18n
packages/render   PDF (react-pdf, in the browser) and DOCX: 8 templates, page-fit loop, cover letter
deploy/cloudflare Worker that serves techswitch.in/cvtuner from Vercel
docs/             PLAN.md, DEPLOY.md
```

## Develop
```bash
pnpm install
pnpm dev        # http://localhost:3000/cvtuner
pnpm test
pnpm typecheck
pnpm build
```
Requires Node 22 and pnpm 10. No environment variables are needed: AI keys come from each user.

## Deploy
Vercel with Root Directory set to `apps/web`, plus the Cloudflare Worker for `techswitch.in/cvtuner`. See [docs/DEPLOY.md](docs/DEPLOY.md).
