# AGENTS — AI contributor guide

Purpose
- Short, actionable guidance so code-assistant agents can be immediately productive in this repo.

Quick commands (run from repository root)
- `npm install`
- `npm run dev` — Vite dev server (http://localhost:5173)
- `npm run build` — `tsc -b` + Vite build
- `npm run preview` — serve production build
- `npm run lint` / `npm run lint:fix` — ESLint (CI requires zero warnings)
- `npm run format` / `npm run format:check` — Prettier
- `npm run test` — Vitest unit/component tests
- `npm run test:e2e` — Playwright end-to-end tests (build + preview handled)
- `npm run db:types` — regenerate `src/lib/supabase/database.types.ts` (requires `SUPABASE_PROJECT_ID`)

Where to look first
- Project overview and requirements: [README.md](README.md)
- Design docs, API and DB schema: [docs/PRD.md](docs/PRD.md), [docs/API-PLAN.md](docs/API-PLAN.md), [docs/DB-SCHEMA.sql](docs/DB-SCHEMA.sql), [docs/ROADMAP.md](docs/ROADMAP.md)
- App entry & routing: [src/main.tsx](src/main.tsx) and [src/app/router.tsx](src/app/router.tsx)
- Feature boundaries and examples: `src/features/*` (feature-sliced layout with per-feature `api/`, `components/`, `pages/`)
- Environment validation: [src/lib/env.ts](src/lib/env.ts)
- Supabase assets: `supabase/` (migrations, functions, seed)

Key conventions agents should follow
- Feature-sliced architecture: keep domain code inside `src/features/<domain>` and prefer cross-feature imports through the feature's `index.ts` barrel.
- Data access is confined to `features/*/api` and `src/lib`; avoid scattered SQL or direct Postgres calls from UI components.
- `src/lib/supabase/database.types.ts` is generated; do not edit manually. Use `npm run db:types` when migrations change.
- Environment variables are validated at startup; missing vars cause early, explicit failures. Do not commit credentials.
- CI enforces: format check → lint (zero warnings) → typecheck → unit tests → build → Playwright. Keep changes small and CI-green.

Notes for automation
- Use `npm run test` for quick unit checks; `npm run test:e2e` runs Playwright and will build/preview as needed.
- For containerized dev use `npm run docker:dev` (Docker Compose) as configured in `docker-compose.yml`.

Common pitfalls
- Do not check in generated supabase types.
- Cross-feature imports that bypass the barrel `index.ts` are discouraged.
- The app assumes Node >= 22.12.0 (see `.nvmrc`) and TypeScript project references (`tsc -b`).

Suggested next agent customizations
- Add a small automation skill that runs the repo's dev checks (`format:check`, `lint`, `typecheck`, `test`) and returns a summarized result.
- Add a quick `playwright` hook skill to run e2e tests and snapshot failures.

If you'd like, I can create or update `.github/copilot-instructions.md` or a CI-focused skill next.
