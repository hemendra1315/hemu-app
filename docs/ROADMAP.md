# Development Roadmap

Assumption: 1–2 developers, ~13 weeks to production. Each phase ends with migrations + tests + a deployable preview. Estimates are dev-weeks.

| Phase | Scope | Deliverables | Est. |
|---|---|---|---|
| **0. Foundations** | Repo, Vite+TS+Tailwind, ESLint/Prettier, Husky, CI (lint/typecheck/test/build), Supabase project (dev/staging/prod), env handling, UI kit primitives, app shell + router + guards, generated DB types | Empty but deployable app; CI green | 1 |
| **1. Auth & Tenancy** | Google Sign-In, `profiles` trigger, academies, `academy_members`, academy switcher, RBAC capability map + `<Can/>`, RLS helpers, pgTAP RLS test harness | A user can create an academy and sign in | 1 |
| **2. Onboarding & Approvals** | Join codes (generate/regenerate/expire/cap), `request_join_by_code`, join-request queue, `approve_join_request` / reject, invites for coaches, pending-approval screens | Player joins by code, owner approves → player row exists | 1 |
| **3. People & Batches** | Player roster + profiles, coach management, venues, batch CRUD, weekly schedule editor, coach assignment, multi-batch player assignment with capacity checks | Academy structure fully manageable | 1.5 |
| **4. Sessions & Attendance** | Session materialization job, calendar + session detail, reschedule/cancel with scope, bulk attendance (mobile-first, offline queue, edit window, audit), attendance summaries | Coach marks a 30-player session in <60s | 2 |
| **5. Drills & Feedback** | Drill library + media upload, platform templates copy-on-use, session plan builder, per-player drill results, feedback form + timeline + rating trends, player-visible view | Coaching workflow complete | 1.5 |
| **6. Billing** | Plans, subscriptions (₹200 default, per-academy/player overrides), fee mode (`academy_pays`/`player_pays`), invoice generation job, flexible renewal (1/3/6/12 months, partial, pro-rata, grace, pause), Razorpay order + webhook, offline payments, allocations ledger, dues dashboard, receipts | Money in, reconciled, idempotent | 2 |
| **7. CricHeroes & Stats** | Team/player linking, CSV import (guaranteed path), nightly sync + sync log (flagged), normalization into matches/performances, stats views, player stat pages | Player profile shows real match stats | 1.5 |
| **8. Notifications** | Web Push + VAPID, service worker, preferences + quiet hours, in-app center, all event templates, session/payment reminder crons | Users get timely, muteable alerts | 1 |
| **9. Reports & Dashboards** | Report jobs (PDF/Excel) for 7 report types, signed downloads, Owner/Coach/Player/Super-Admin dashboards, materialized view refresh | Owner exports monthly register in one click | 1.5 |
| **10. Hardening & Launch** | Full RLS/permission test matrix, seed + demo academy, PWA install/offline, a11y (WCAG AA) pass, i18n en/hi, perf budgets, Sentry + logs, load test 500 players/academy, backups + restore drill, runbook, pilot academy onboarding | Production launch | 1.5 |

**Total ≈ 13 dev-weeks** (~9–10 calendar weeks with 2 devs).

## Milestones
- **M1 (end Ph.2)** — internal demo: sign in, create academy, join by code, approve.
- **M2 (end Ph.4)** — pilot-usable core: batches, sessions, attendance. *Earliest real-academy pilot.*
- **M3 (end Ph.6)** — revenue-ready: subscriptions + payments live.
- **M4 (end Ph.9)** — feature-complete beta.
- **M5 (end Ph.10)** — GA.

## Definition of Done (each phase)
Migrations reviewed & reversible · RLS policy + pgTAP test for every new table · unit tests on business logic (billing math, attendance %, recurrence) · one Playwright e2e for the phase's happy path · a11y + mobile check · docs/README updated · CI green on preview deploy.

## Post-v1 backlog
Native apps (Expo) · parent login role · fitness/injury tracking · video analysis + annotation · tournament/team selection module · WhatsApp reminders · academy website builder · trials & lead pipeline · multi-currency · advanced analytics (workload, progression models).

## Top risks & mitigations
| Risk | Mitigation |
|---|---|
| CricHeroes has no public API / ToS limits | Ship CSV + manual entry as the primary path; scraping behind a feature flag pending ToS review |
| RLS complexity → leakage | pgTAP matrix test per role per table, run in CI; deny-by-default |
| Payment double-charge/reconciliation | Provider idempotency keys, unique `provider_payment_id`, ledger invariant test |
| Offline gyms/grounds (poor network) | PWA offline cache + queued attendance writes with retry |
| Timezone/DST bugs in scheduling | store UTC `timestamptz`, render in academy timezone, tz test suite |
| Push deliverability on iOS Safari | in-app + email fallback for all critical events |

---

**Awaiting your approval on this plan plus the 5 open decisions in the PRD (payment gateway, CricHeroes approach, parent role, push strategy, multi-academy players) before any application code is written.**
