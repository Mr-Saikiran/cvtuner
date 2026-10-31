# CVTuner

Tune your resume to any job description, in any field. Exports **PDF and Word**, and the resume is always fitted to **2 pages (3 at most)**.
It will be served at **[techswitch.in/cvtuner](https://techswitch.in/cvtuner)**.

- **Paste a job description.** CVTuner pulls out its skills, duties and section weights (requirements count more than nice-to-haves).
- **See your match.** Each skill is marked as in your resume or missing. You tap the missing ones you really have, and nothing is added without that.
- **Rule engine, no AI key needed.** It writes basic sentences from the job description's duties, in **passive voice** ("Vendor contracts were managed, and costs were reduced.") or with **action verbs**, and adds them to the role that fits best.
- **Review every change.** You can edit or untick each new line, and you can reorder skills and add a summary line.
- **Fit to the page limit.** The layout gets denser first, then the least relevant lines are dropped. Your base profile is never changed.
- **Save a version per job** and reopen it later. Everything stays in your browser.
- **Works on phones and desktops**, and can be installed as an app (PWA).

The full roadmap is in [docs/PLAN.md](docs/PLAN.md). Phase 2 adds your own AI keys, job-link fetching and accounts. Phase 3 adds the mobile app and auto mode.

## Layout

```
apps/web          Next.js app (basePath /cvtuner), UI and /api/import
packages/core     resume schema, JD parser, skills taxonomy, voice engine, tailoring, resume text import
packages/render   PDF (react-pdf, runs in the browser) and DOCX builders, page-fit loop
docs/             PLAN.md, DEPLOY.md
```

## Develop

```bash
pnpm install
pnpm dev            # http://localhost:3000/cvtuner
pnpm test           # core + render tests
pnpm typecheck
pnpm build
```

Requires Node 22 and pnpm 10.

## Deploy

Use Vercel with **Root Directory = `apps/web`**. Then forward `techswitch.in/cvtuner` to that deployment. [docs/DEPLOY.md](docs/DEPLOY.md) has ready-made steps for Vercel, Cloudflare and Nginx.
