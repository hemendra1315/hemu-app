# Folder Structure

Monorepo-lite: one Vite + React app plus the Supabase project in the same repo.
Architecture: **feature-sliced** (`src/features/<domain>`) with a thin shared layer. No cross-feature imports except through `features/<x>/index.ts` barrels.

```
cricket-academy-manager/
├── .env.example
├── .github/workflows/            # ci.yml (lint+typecheck+test+build), deploy.yml, migrations.yml
├── README.md  ARCHITECTURE.md  CONTRIBUTING.md
├── package.json  pnpm-lock.yaml  tsconfig.json  vite.config.ts
├── tailwind.config.ts  postcss.config.js  eslint.config.js  .prettierrc
├── index.html
├── docs/
│   ├── PRD.md  DB-SCHEMA.sql  API-PLAN.md  ROADMAP.md  RLS-MATRIX.md
├── public/
│   ├── manifest.webmanifest  sw.js  icons/
├── supabase/
│   ├── config.toml
│   ├── migrations/               # 0001_init.sql 0002_rls.sql 0003_billing.sql ...
│   ├── seed/                     # seed.sql, drill_templates.sql, demo_academy.sql
│   ├── functions/                # Deno Edge Functions (one dir each)
│   │   ├── _shared/              # cors.ts, auth.ts (JWT+role guard), supabase.ts, errors.ts, zod.ts
│   │   ├── join-academy/
│   │   ├── approve-player/
│   │   ├── payments-create-order/
│   │   ├── payments-webhook/         # Razorpay/Stripe, idempotent
│   │   ├── invoices-generate/        # cron
│   │   ├── receipt-generate/
│   │   ├── report-generate/          # PDF/Excel → Storage
│   │   ├── notifications-dispatch/   # web-push fan-out
│   │   ├── session-reminders/        # cron
│   │   ├── sessions-materialize/     # cron: recurrence → sessions
│   │   ├── cricheroes-sync/
│   │   └── cricheroes-import-csv/
│   └── tests/                    # pgTAP RLS + RPC tests
└── src/
    ├── main.tsx  App.tsx  vite-env.d.ts
    ├── app/
    │   ├── router.tsx            # route tree + lazy routes
    │   ├── providers.tsx         # QueryClient, Auth, Academy, Theme, Toast, ErrorBoundary
    │   ├── guards/               # RequireAuth, RequireRole, RequireAcademy, RequireApproved
    │   └── layouts/              # AppShell, AuthLayout, OnboardingLayout, PrintLayout
    ├── lib/
    │   ├── supabase/             # client.ts, admin-types.ts, database.types.ts (generated)
    │   ├── query/                # queryClient.ts, keys.ts (query-key factory)
    │   ├── auth/                 # google.ts, session.ts
    │   ├── rbac/                 # permissions.ts (capability map), can.ts, useCan.ts
    │   ├── money.ts  date.ts (tz-aware, dayjs)  format.ts  csv.ts  validators.ts (zod)
    │   ├── push/                 # register.ts, vapid.ts
    │   └── analytics/  logger.ts  env.ts
    ├── components/
    │   ├── ui/                   # Button, Input, Select, Modal, Drawer, Table, Tabs, Badge,
    │   │                         # Toast, Skeleton, EmptyState, Pagination, DatePicker, Avatar
    │   ├── charts/               # LineChart, BarChart, DonutChart (recharts wrappers)
    │   ├── data/                 # DataTable, FilterBar, ExportMenu, BulkActionBar
    │   └── feedback/             # ErrorState, LoadingScreen, ConfirmDialog
    ├── features/
    │   ├── auth/                 # {api,components,hooks,pages}: SignIn, Callback, useSession
    │   ├── onboarding/           # JoinWithCode, CreateAcademy, PendingApproval, ProfileSetup
    │   ├── academies/            # settings, join codes, fee mode, academy switcher
    │   ├── members/              # invites, role management
    │   ├── players/              # roster, profile, approvals queue
    │   ├── coaches/              # coach list, assignment, coach profile
    │   ├── batches/              # batch CRUD, schedule editor, roster assignment
    │   ├── sessions/             # calendar, session detail, plan builder, reschedule
    │   ├── attendance/           # MarkAttendance (bulk), history, offline queue
    │   ├── drills/               # library, drill form, media upload, session plan picker
    │   ├── feedback/             # feedback form, timeline, rating trends
    │   ├── cricheroes/           # link team/players, sync status, CSV import
    │   ├── stats/                # batting/bowling/fielding cards, trends
    │   ├── billing/              # subscriptions, invoices, pay-now, offline payment, dues
    │   ├── reports/              # report builder, job list, download
    │   ├── notifications/        # bell, center, preferences
    │   ├── dashboard/            # OwnerDashboard, CoachDashboard, PlayerDashboard
    │   └── admin/                # super-admin: academies, plans, jobs, impersonation
    ├── hooks/                    # useDebounce, useMediaQuery, useLocalStorage, useOnlineStatus
    ├── types/                    # domain.ts, api.ts, enums.ts (re-export generated DB types)
    ├── styles/                   # index.css, tailwind layers, print.css
    ├── locales/                  # en.json, hi.json
    └── test/                     # setup.ts, msw handlers, factories, e2e/ (Playwright)
```

### Per-feature convention
```
features/attendance/
├── api/            # supabase queries + RPC wrappers (pure, typed)
├── hooks/          # useSessionRoster(), useMarkAttendance() (TanStack Query)
├── components/     # RosterRow, StatusToggle, BulkBar
├── pages/          # MarkAttendancePage, AttendanceHistoryPage
├── schemas.ts      # zod
├── types.ts
└── index.ts        # public barrel
```

### Rules
- Data access only in `features/*/api` and `lib/supabase`; components never call `supabase` directly.
- `database.types.ts` is generated (`supabase gen types typescript`) — never hand-edited.
- All server-side secrets (gateway keys, VAPID private key, service role) live only in Edge Function env.
- Money always `*_paise: number`; formatting only via `lib/money.ts`.
