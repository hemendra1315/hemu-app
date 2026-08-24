# Cricket Academy Manager

A multi-tenant SaaS web application (with Android wrapper via Capacitor) for managing cricket academies: player rosters, training batches, sessions, attendance, drills, match scorecards, statistics, notifications, and platform administration.

---

## Current Status

Several core modules are **fully implemented** and backed by real database queries. The table below summarises the current state per module (verified from source code):

| Module | Status |
|---|---|
| Authentication (email + Google OAuth, phone OTP) | ✅ Implemented |
| Profile onboarding (name, phone verification) | ✅ Implemented |
| Academy multi-tenancy & member management | ✅ Implemented |
| Join-code enrolment & request approval | ✅ Implemented |
| Training batches | ✅ Implemented |
| Training sessions | ✅ Implemented |
| Attendance (session, batch, player views) | ✅ Implemented |
| Drills (create, assign, complete) | ✅ Implemented |
| Match entry wizard (multi-step) | ✅ Implemented |
| CricHeroes PDF import | ✅ Implemented |
| Match detail view (batting / bowling / fielding / awards) | ✅ Implemented |
| Player statistics & performance charts | ✅ Implemented |
| Owner & Coach dashboards with analytics | ✅ Implemented |
| Player & Parent dashboards | ✅ Implemented |
| Player profile page | ✅ Implemented |
| Notifications & announcements | ✅ Implemented |
| Academy settings & branding (logo upload) | ✅ Implemented |
| Platform Super Admin dashboard | ✅ Implemented |
| Parent portal (link child, view stats & sessions) | ✅ Implemented |
| PWA (installable, service worker) | ✅ Implemented |
| Android app via Capacitor | ✅ Integrated |
| Light / dark / system theme | ✅ Implemented |
| Billing / payments | ⬜ Placeholder (directory only) |
| Reporting / exports | ⬜ Placeholder (directory only) |
| Coach feedback module | ⬜ Placeholder (directory only) |
| CricHeroes standalone feature directory | ⬜ Placeholder (directory only) |
| Print layout | ⬜ Placeholder (`/print/placeholder`) |

---

## Tech Stack

All technologies verified from `package.json`, `vite.config.ts`, `capacitor.config.ts`, and source imports.

| Layer | Technology |
|---|---|
| UI framework | React 19 |
| Language | TypeScript ~6.0 (strict, project references) |
| Build tool | Vite 8 |
| Styling | Tailwind CSS v4 |
| Routing | React Router 7 (browser router, lazy-loaded routes) |
| Server state | TanStack Query v5 |
| Client state | Zustand v5 |
| Forms | React Hook Form v7 + Zod v4 |
| Backend / database | Supabase (Postgres + RLS, Storage, Auth, Edge Functions) |
| PDF parsing | pdfjs-dist |
| Date utilities | date-fns, dayjs |
| Icons | Lucide React |
| PWA | vite-plugin-pwa |
| Mobile | Capacitor 8 (Android; `@capacitor/camera`, `@capacitor/browser`, `@capacitor/app`) |
| Unit tests | Vitest 4 + Testing Library |
| E2E tests | Playwright |
| Linting | ESLint 9 + typescript-eslint |
| Formatting | Prettier |
| Git hooks | Husky + lint-staged |
| Containerisation | Docker (Dockerfile.dev + docker-compose.yml) |
| Deployment | Vercel (vercel.json present; SPA rewrite configured) |
| SuperAdmin CLI | Custom Node.js CLI (`tsx scripts/superadmin-cli.ts`) |

---

## Architecture

### Frontend

Feature-sliced design: each domain lives in `src/features/<domain>` with its own `api/`, `hooks/`, `components/`, and `pages/` sub-directories. Cross-feature imports must go through the feature's `index.ts` barrel only. Data access is confined to `features/*/api` and `src/lib`.

Route-level code splitting is applied to every page via `React.lazy()`. Guards compose as layout routes in the router tree:

```
RequireAuth → RequireProfileOnboarding → RequireAcademy → RequireRole → Page
```

### Backend

Supabase hosted Postgres with Row Level Security (RLS). All academy-scoped rows carry `academy_id`; reads are gated by an active membership. Multi-table writes (create academy, redeem join code, save match result) run inside RPC functions to prevent partial writes.

### Mobile

The Vite build output is wrapped by Capacitor to produce an Android APK. Live-reload during development is supported via the `CAP_LIVE_RELOAD` env var (`npm run dev:android`).

---

## User Roles

Roles are determined by **active memberships** in the currently selected academy. A pending join request grants no capabilities. `super_admin` comes from `profiles.is_super_admin` rather than a membership row.

| Role | Enum | Description |
|---|---|---|
| Super Admin | `super_admin` | Platform-level administrator; full access across all academies |
| Academy Owner | `academy_owner` | Manages a specific academy; all operational capabilities |
| Coach | `coach` | Manages sessions, attendance, drills, matches within the academy |
| Player | `player` | Views own data: sessions, attendance, drills, stats, matches |
| Parent | `parent` | Views linked children's sessions, attendance, stats, announcements |

After sign-in, `HomeRedirect` routes each role to its landing page: `/admin`, `/dashboard`, `/coach`, `/player`, or `/parent/dashboard`.

---

## Role & Capability Matrix

Sourced from `src/lib/rbac/permissions.ts`. **UI gating only** — Postgres RLS is the authoritative enforcement layer.

| Capability | Player | Coach | Owner | Parent | Super Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| `academy:create` | | | ✓ | | ✓ |
| `academy:update` | | | ✓ | | ✓ |
| `academy:regenerate_join_code` | | | ✓ | | ✓ |
| `members:manage` | | | ✓ | | ✓ |
| `players:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `players:manage` | | | ✓ | | ✓ |
| `players:approve` | | | ✓ | | ✓ |
| `coaches:read` | | ✓ | ✓ | | ✓ |
| `coaches:manage` | | | ✓ | | ✓ |
| `batches:read` | | ✓ | ✓ | | ✓ |
| `batches:manage` | | | ✓ | | ✓ |
| `matches:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `matches:manage` | | ✓ | ✓ | | ✓ |
| `sessions:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `sessions:manage` | | ✓ | ✓ | | ✓ |
| `attendance:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `attendance:mark` | | ✓ | ✓ | | ✓ |
| `drills:read` | ✓ | ✓ | ✓ | | ✓ |
| `drills:manage` | | ✓ | ✓ | | ✓ |
| `feedback:read_own` | ✓ | ✓ | ✓ | | ✓ |
| `feedback:write` | | ✓ | ✓ | | ✓ |
| `cricheroes:manage` | | | ✓ | | ✓ |
| `stats:read_own` | ✓ | | | ✓ | ✓ |
| `stats:read_all` | | ✓ | ✓ | | ✓ |
| `billing:read_own` | ✓ | | ✓ | | ✓ |
| `billing:manage` | | | ✓ | | ✓ |
| `reports:export` | ✓ | ✓ | ✓ | | ✓ |
| `notifications:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `announcements:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `announcements:manage` | | ✓ | ✓ | | ✓ |
| `platform:manage` | | | | | ✓ |

---

## Screen Inventory

All routes sourced from `src/app/router.tsx`. Status reflects whether the page contains functional UI and live data queries (✅), partial implementation (🟡), or an empty/placeholder component (⬜).

### Authentication & Onboarding

| Screen | Route | Role/Access | Purpose | Status |
|---|---|---|---|---|
| Sign In | `/sign-in` | Public | Email/password + Google OAuth | ✅ |
| Auth Callback | `/auth/callback` | Public | OAuth redirect handler | ✅ |
| Profile Onboarding | `/onboarding/profile` | Authenticated | Set full name, phone, OTP verify | ✅ |
| Onboarding Start | `/onboarding` | Authenticated | Choose create or join academy | ✅ |
| Create Academy | `/onboarding/create-academy` | `super_admin` only | Create a new academy | ✅ |
| Join Academy | `/onboarding/join-academy` | Authenticated | Enter join code to request membership | ✅ |
| Pending Approval | `/onboarding/pending` | Authenticated | Waiting for owner to approve request | ✅ |
| Select Academy | `/onboarding/select-academy` | Multi-academy users | Choose active academy | ✅ |
| Owner Invitation | `/academy/invite/:token`, `/invite/:token` | Public | Accept academy owner invitation | ✅ |

### Dashboards

| Screen | Route | Role/Access | Purpose | Status |
|---|---|---|---|---|
| Owner Dashboard | `/dashboard`, `/owner` | `academy_owner`, `super_admin` | KPIs, today's sessions, quick-action buttons, activity feed, join code | ✅ |
| Coach Dashboard | `/coach` | `coach`, `academy_owner`, `super_admin` | Session schedule, players needing attention, performance leaders, activity feed | ✅ |
| Player Dashboard | `/me`, `/player` | `player`, `super_admin` | Personal stats, upcoming sessions, recent form, drills, awards, performance charts | ✅ |
| Parent Dashboard | `/parent/dashboard` | `parent`, `super_admin` | Children's sessions, attendance, stats, matches, announcements | ✅ |
| Platform Admin | `/admin` | `super_admin` | Platform analytics, academy CRUD, user search, owner invitations, seed data | ✅ |

### Member Management

| Screen | Route | Role/Access | Purpose | Status |
|---|---|---|---|---|
| Players List | `/members` | `coach`, `academy_owner`, `super_admin` | Roster search/filter; join request approval with batch assignment; role changes | ✅ |
| Player Profile | `/members/:memberId` | `coach`, `academy_owner`, `super_admin` | Stats, match history, drill summary, attendance history | ✅ |
| Player Attendance | `/members/:memberId/attendance` | `coach`, `academy_owner`, `super_admin` | Per-player attendance history | ✅ |
| Own Profile | `/profile` | All authenticated | Edit own profile, theme toggle, logout | ✅ |

### Batches

| Screen | Route | Role/Access | Purpose | Status |
|---|---|---|---|---|
| Batches List | `/batches` | `coach`, `academy_owner`, `super_admin` | List batches with player count; create/delete | ✅ |
| Batch Detail | `/batches/:batchId` | `coach`, `academy_owner`, `super_admin` | Batch info, roster, add/remove players | ✅ |
| Batch Attendance | `/batches/:batchId/attendance` | `coach`, `academy_owner`, `super_admin` | Attendance history for a batch | ✅ |

### Training Sessions

| Screen | Route | Role/Access | Purpose | Status |
|---|---|---|---|---|
| Sessions List | `/sessions` | All (read-only for players/parents) | Upcoming and past sessions | ✅ |
| Session Detail | `/sessions/:sessionId` | All | Session info, enrolled players | ✅ |
| Session Attendance | `/sessions/:sessionId/attendance` | `coach`, `academy_owner`, `super_admin` | Mark present/absent per player | ✅ |

### Attendance

| Screen | Route | Role/Access | Purpose | Status |
|---|---|---|---|---|
| Attendance Overview | `/attendance` | `coach`, `academy_owner`, `super_admin` | Academy-wide attendance summary | ✅ |

### Matches

| Screen | Route | Role/Access | Purpose | Status |
|---|---|---|---|---|
| Matches List | `/matches` | All | All academy matches | ✅ |
| Add Match | `/matches/new` | `coach`, `academy_owner`, `super_admin` | Multi-step wizard + CricHeroes PDF import | ✅ |
| Match Detail | `/matches/:matchId` | All | Batting, bowling, fielding scorecards + awards | ✅ |

### Drills

| Screen | Route | Role/Access | Purpose | Status |
|---|---|---|---|---|
| Drills | `/drills` | All (manage-gated) | Drill library; create, assign, complete | ✅ |
| Drill Detail | `/drills/:drillId` | All | Full drill info, assignment list | ✅ |

### Statistics

| Screen | Route | Role/Access | Purpose | Status |
|---|---|---|---|---|
| Stats | `/stats` | All | Players: personal stats; coaches/owners: academy leaderboard, records, charts | ✅ |

### Notifications & Announcements

| Screen | Route | Role/Access | Purpose | Status |
|---|---|---|---|---|
| Notifications | `/notifications`, `/parent/notifications` | All | In-app notification centre with mark-read / delete | ✅ |
| Announcements | `/announcements` | All | Academy announcements feed | ✅ |
| Create Announcement | `/announcements/new` | `coach`, `academy_owner`, `super_admin` | Compose and publish announcement | ✅ |

### Academy Settings

| Screen | Route | Role/Access | Purpose | Status |
|---|---|---|---|---|
| Academy Settings | `/settings`, `/settings/academy` | `academy_owner`, `super_admin` | Edit name, city, logo; manage join code | ✅ |

### Parent Portal

| Screen | Route | Role/Access | Purpose | Status |
|---|---|---|---|---|
| Parent Dashboard | `/parent/dashboard` | `parent`, `super_admin` | Children overview with session/attendance/stats | ✅ |
| Link Player | `/parent/link-player` | `parent`, `super_admin` | Link a child by code | ✅ |
| Child Profile | `/parent/child/:memberId` | `parent`, `super_admin` | View child's player profile | ✅ |
| Parent Notifications | `/parent/notifications` | `parent`, `super_admin` | Notification centre | ✅ |
| Parent Profile | `/parent/profile` | `parent`, `super_admin` | Own profile page | ✅ |

### Utility

| Screen | Route | Role/Access | Purpose | Status |
|---|---|---|---|---|
| More | `/more` | All | Mobile overflow menu (all sections, settings, logout) | ✅ |
| Forbidden | `/forbidden` | All | Role-access denied page | ✅ |
| Not Found | `*` | All | 404 catch-all | ✅ |
| Print (placeholder) | `/print/placeholder` | All | Future print/export view | ⬜ |

---

## Features / Modules

### Authentication (`features/auth`)
Email/password and Google OAuth sign-in via Supabase Auth. Post-Google sign-in triggers a profile onboarding step (full name required, phone + OTP optional). Auth state is held in a Zustand `authStore` and hydrated by `AuthProvider` on mount.

### Academies (`features/academies`)
Multi-tenant core. `useActiveAcademy` and `useMemberships` expose the current academy context. `AcademySwitcher` lets users with multiple active memberships switch context. Join codes are generated per-role (`player` or `coach`). Owners can regenerate codes.

### Members (`features/members`)
Roster list with search, filter by role/status/batch, and inline role change. Pending join requests surface with approve/reject actions; approval modal allows batch assignment.

### Training Batches (`features/batches`)
CRUD for batches (name, age group, optional coach, days, timing). Batch detail shows enrolled player roster with add/remove capability.

### Training Sessions (`features/sessions`)
Schedule training sessions linked to a batch. Session detail shows enrolled players. Attendance can be marked directly from the session detail page.

### Attendance (`features/attendance`)
Three views: session-level (mark present/absent per player), batch-level history, and individual player history. Overview page aggregates academy-wide attendance.

### Drills (`features/drills`)
Coaches/owners create drills (name, category: batting/bowling/fielding/fitness, difficulty: beginner/intermediate/advanced/elite, description, video URL). Drills can be assigned to individual players with optional due dates.

### Matches (`features/matches`)
**Multi-step wizard** for recording match results:
1. Match Details — name, date, opponent, format (T20/ODI/Test/T10/Custom), type (practice/friendly/league/tournament), overs, team score, result, winning margin
2. Select Players — pick squad members
3. Batting Order — set batting positions (0 = opener)
4. Scorecard — batting (runs, balls, 4s, 6s, dismissal type), bowling (overs, maidens, runs, wickets, wides, no-balls), fielding (catches, run-outs, stumpings)
5. Awards — Player of Match, Best Batter, Best Bowler, Best Fielder
6. Review — summary before save

**CricHeroes PDF Import**: upload a CricHeroes scorecard PDF; the app parses it, auto-detects team names, scores, format, and player stats using text analysis; fuzzy-matches extracted player names against the academy roster (Levenshtein similarity with ambiguity detection); handles guest players; saves persistent name mappings for future imports.

Match detail page shows batting, bowling, and fielding scorecards in responsive card (mobile) and table (desktop) layouts, plus match awards.

### Statistics (`features/stats`, `features/players`)
`StatsPage` adapts by role: players see personal batting/bowling aggregates and charts; coaches/owners see academy leaderboard, top performers, performance charts, and academy records. `PlayerProfilePage` computes matches played, total runs, batting average, strike rate, total wickets, bowling economy, attendance percentage, career highlights (milestone badges), run trend charts, and recent awards.

### Dashboards (`features/dashboard`)
- **Owner**: today's session count, total expected players, active batches, total players; today's sessions with attendance status; join code card; recent activity feed
- **Coach**: upcoming sessions, players needing attention, leaderboard, activity feed
- **Player**: personal stats summary + charts
- **Parent**: linked children selector; selected child's upcoming sessions, attendance, matches, notifications

### Notifications & Announcements (`features/notifications`)
In-app notifications with mark-as-read, mark-all-as-read, and delete. Click routing to the relevant resource. Announcements feed with create capability for coaches/owners.

### Academy Settings (`features/academies`)
Edit academy name, city, logo (image upload to Supabase Storage with preview). Join code display with copy and regenerate actions.

### Platform Admin (`features/admin`)
Super Admin-only dashboard with platform analytics (total academies, users, members), academy management (create with owner invitation email, delete, view details), user list with search, owner invitation link regeneration. Includes a **Test App As** mode for impersonating Student/Coach/Owner roles without modifying real data.

### Parents (`features/parents`)
Parents link to child players via a link code. Parent Dashboard shows selected child's upcoming sessions, attendance summary, recent matches with batting/bowling stats, and announcements.

### PWA (`features/pwa`)
`vite-plugin-pwa` generates a service worker and manifest. `usePwaInstall` hook handles the `beforeinstallprompt` event for an in-app install prompt. `useShare` provides the Web Share API with clipboard fallback.

### Placeholder Modules
- **`features/billing`** — capabilities defined in RBAC (`billing:read_own`, `billing:manage`) but no implementation
- **`features/reports`** — `reports:export` capability defined; `/print/placeholder` route wired; no implementation
- **`features/feedback`** — `feedback:read_own` and `feedback:write` capabilities defined in RBAC; no standalone feedback UI. Note: coach notes (read per player) are available on the Player Profile page via `usePlayerCoachNotes`.
- **`features/coaches`** — empty directory; coach management is within `features/members`
- **`features/cricheroes`** — empty directory; CricHeroes import is in `features/matches/import/`

---

## Database / Data Model

48 migration files in `supabase/migrations/` (applied in order with `supabase db reset`). Key entities:

| Entity | Key Columns | Notes |
|---|---|---|
| `profiles` | `id`, `full_name`, `avatar_url`, `phone`, `phone_verified`, `is_super_admin` | Synced from `auth.users` via trigger |
| `academies` | `id`, `name`, `city`, `timezone`, `logo_url` | Multi-tenant root |
| `academy_members` | `id`, `academy_id`, `user_id`, `role`, `status` | Roles: owner/coach/player/parent |
| `academy_join_codes` | `academy_id`, `code`, `role`, `expires_at` | Per-role codes |
| `join_requests` | `academy_id`, `user_id`, `status`, `requested_role` | Pending → approved/rejected |
| `owner_invitations` | `academy_id`, `token`, `email`, `expires_at`, `accepted_at` | Super-admin-only creation |
| `batches` | `academy_id`, `name`, `age_group`, `coach_id` (nullable) | Training groups |
| `batch_members` | `batch_id`, `academy_member_id` | Many-to-many |
| `training_sessions` | `academy_id`, `batch_id`, `title`, `scheduled_at` | Individual sessions |
| `attendance` | `session_id`, `academy_member_id`, `academy_id`, `status` | `present` or `absent` |
| `drills` | `academy_id`, `name`, `category`, `difficulty`, `description`, `video_url` | Drill library |
| `drill_assignments` | `drill_id`, `assigned_to`, `academy_id`, `status`, `due_date` | Per-player assignment |
| `matches` | `academy_id`, `match_name`, `match_date`, `opponent_name`, `format`, `match_type`, `result`, `status` | Match header |
| `match_lineups` | `match_id`, `member_id`, `batting_order`, `is_captain`, `is_guest`, `guest_name` | Supports guest players |
| `match_batting` | `match_id`, `member_id`, `runs`, `balls`, `fours`, `sixes`, `is_out`, `dismissal_type` | Batting scorecard |
| `match_bowling` | `match_id`, `member_id`, `overs`, `maidens`, `runs_conceded`, `wickets`, `wides`, `no_balls` | Bowling scorecard |
| `match_fielding` | `match_id`, `member_id`, `catches`, `run_outs`, `stumpings` | Fielding stats |
| `match_awards` | `match_id`, `player_of_match_id`, `best_batter_id`, `best_bowler_id`, `best_fielder_id` | Match awards |
| `player_statistics` | Aggregate batting/bowling per player | Materialised/view; drives stats pages |
| `player_milestones` | `member_id`, `milestone_type`, `achieved_at` | Career milestone badges |
| `academy_records` | `academy_id`, `record_type`, `value`, `holder_id` | Academy best-ever records |
| `cricheroes_player_mappings` | `academy_id`, `cricheroes_name`, `academy_member_id`, `is_guest` | Persisted PDF import name map |
| `notifications` | `user_id`, `academy_id`, `notification_type`, `title`, `body`, `read_at`, `metadata` | In-app notifications |
| `announcements` | `academy_id`, `author_id`, `title`, `body`, `published_at` | Academy-wide announcements |
| `parent_player_links` | `parent_member_id`, `player_member_id`, `academy_id` | Parent ↔ child mapping |
| `activity_log` | `academy_id`, `actor_id`, `action`, `metadata`, `created_at` | Recent activity feed |

Security: all tables use RLS with `SECURITY DEFINER` helper functions (`is_member`, `is_staff`, `is_owner`, `is_super_admin`). Multi-table writes use RPCs (`save_match_result`, `create_academy`, `request_join_by_code`, `approve_join_request`).

`src/lib/supabase/database.types.ts` is generated — run `SUPABASE_PROJECT_ID=<ref> npm run db:types` after any migration; never edit it manually.

---

## Authentication & Authorization

### Authentication Flow

1. User visits `/sign-in` → signs in via email/password or Google OAuth
2. Google OAuth redirects through `/auth/callback` which exchanges the code for a session
3. On first Google sign-in, `isProfileComplete()` check redirects to `/onboarding/profile`
4. `HomeRedirect` routes to the appropriate dashboard based on role
5. Users with no active memberships go to onboarding to create or join an academy
6. Pending join requests land on `/onboarding/pending` until approved

### Authorization

- **Route guards**: `RequireAuth` → `/sign-in`, `RequireProfileOnboarding` → `/onboarding/profile`, `RequireAcademy` → `/onboarding`, `RequireRole` → `/forbidden`
- **UI gating**: `useCan(capability)` hook and `<Can do="capability">` component from `src/lib/rbac`
- **Data enforcement**: Postgres RLS; roles resolved at query time from `academy_members.role` and `profiles.is_super_admin`
- **Multi-tenant isolation**: every academy-scoped query includes `academy_id`; RPCs enforce server-side

### Supabase Configuration

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are the only credentials that reach the browser
- Google sign-in requires the Google provider enabled in Supabase Dashboard → Authentication → Providers, with the Authorized redirect URI set to `https://<project-ref>.supabase.co/auth/v1/callback`
- The app's own redirect (`/auth/callback`) must be in the Supabase URL allow list

---

## Project Structure

```
/
├── android/                    Capacitor Android project
├── capacitor.config.ts         Capacitor app config (appId: com.hemu.cricketacademy)
├── docs/                       Design documents (PRD, DB-SCHEMA, API-PLAN, ROADMAP, FOLDER-STRUCTURE)
├── e2e/                        Playwright end-to-end tests
├── public/                     Static assets (icons, PWA manifest)
├── scripts/                    superadmin-cli.ts, Android live-reload helper
├── src/
│   ├── App.tsx                 Root React component
│   ├── main.tsx                Entry point
│   ├── pwa.ts                  PWA service-worker registration
│   ├── app/
│   │   ├── router.tsx          Central route tree (all routes defined here)
│   │   ├── providers.tsx       TanStack Query + auth providers
│   │   ├── guards/             RequireAuth, RequireAcademy, RequireRole,
│   │   │                       RequireProfileOnboarding, HomeRedirect
│   │   └── layouts/            AppShell, AuthLayout, OnboardingLayout, PrintLayout
│   ├── components/
│   │   ├── charts/             SimpleBarChart, SimpleLineChart
│   │   ├── feedback/           ErrorState, EmptyState, LoadingScreen
│   │   ├── form/               FormField (RHF wrapper), TimeRangePicker
│   │   ├── mobile/             MobilePageHeader, MobileBottomNav
│   │   └── ui/                 Design-system primitives (Avatar, Badge, Button, Card,
│   │                           Input, Modal, Select, Table, Skeleton, etc.)
│   ├── features/               Domain modules (see Features section above)
│   ├── hooks/                  useDebounce, useMediaQuery, useOnlineStatus,
│   │                           useLocalStorage, useThemeEffect
│   ├── lib/
│   │   ├── api/                HTTP client + error normalisation (ApiError)
│   │   ├── env.ts              Zod-validated env vars (fails fast on missing)
│   │   ├── logger.ts           Centralised console wrapper + reportError hook
│   │   ├── query.ts            TanStack Query client config
│   │   ├── rbac/               permissions.ts, useCan.ts, Can component
│   │   ├── supabase/           client.ts + database.types.ts (generated)
│   │   ├── utils/              date, money, string helpers
│   │   └── validators.ts       isUUID, cricket overs notation
│   ├── locales/                i18n locale files (en)
│   ├── pages/                  MorePage, ForbiddenPage, NotFoundPage
│   ├── stores/                 Zustand: authStore, academyStore, themeStore,
│   │                           uiStore (toasts), testModeStore
│   ├── styles/                 Global CSS; semantic CSS variables (light/dark)
│   ├── test/                   Vitest setup
│   └── types/                  Global TypeScript types (enums.ts, index.ts)
└── supabase/
    ├── config.toml             Local Supabase project config
    ├── migrations/             48 SQL migration files
    ├── functions/              Supabase Edge Functions
    ├── seed/                   Seed data directories
    └── seed.sql                Demo data seed script
```

---

## Development Setup

### Prerequisites

- **Node.js ≥ 22.12.0** (`.nvmrc` pins `22.12.0`; use `nvm use`)
- **npm ≥ 10**
- A [Supabase](https://supabase.com) project with migrations applied
- **Docker** (optional, for the containerised dev server)
- **Android Studio + JDK** (optional, for Capacitor Android builds)

### Installation

```bash
nvm use                   # activates Node 22.12.0 from .nvmrc
npm install
cp .env.example .env      # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev               # http://localhost:5173
```

`src/lib/env.ts` validates all env vars with Zod at startup; a missing required variable fails immediately with a descriptive error message.

### Docker

```bash
cp .env.example .env
npm run docker:dev        # docker compose up --build → http://localhost:5173
```

### Database

```bash
supabase start            # start local Supabase stack
supabase db reset         # apply all migrations in order
```

### Android (Capacitor)

```bash
npm run build             # produce dist/
npx cap sync android      # sync web assets to android/
# Then open android/ in Android Studio, or use live-reload:
CAP_LIVE_RELOAD=<LAN_IP> npm run dev:android
```

---

## Environment Variables

### Required (browser-visible, `VITE_` prefix)

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `VITE_APP_NAME` | App display name |
| `VITE_APP_URL` | App base URL |
| `VITE_DEFAULT_TIMEZONE` | Default timezone (e.g. `Asia/Kolkata`) |
| `VITE_DEFAULT_LOCALE` | Default locale (e.g. `en`) |

### Optional (browser-visible)

| Variable | Description |
|---|---|
| `VITE_VAPID_PUBLIC_KEY` | Web Push public VAPID key |
| `VITE_SENTRY_DSN` | Sentry error reporting DSN |
| `VITE_LOG_LEVEL` | Log verbosity (`debug` / `info` / `warn` / `error`) |
| `VITE_ENABLE_DEVTOOLS` | Enable TanStack Query Devtools |

### Server-side only (never expose to browser)

| Variable | Description |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (SuperAdmin CLI only) |
| `SUPABASE_PROJECT_ID` | Project reference ID for `npm run db:types` |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI token for `db push` / `db:types` |
| `SUPERADMIN_PASSWORD_HASH` | bcrypt hash for SuperAdmin CLI authentication |
| `SUPERADMIN_ENCRYPTION_KEY` | 32-byte hex encryption key for SuperAdmin CLI |
| `CAP_LIVE_RELOAD` | LAN IP for Capacitor Android live-reload |

---

## Available Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server (http://localhost:5173) |
| `npm run dev:android` | Vite + Capacitor live-reload for Android device |
| `npm run build` | `tsc -b` + Vite production build (includes PWA service worker) |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint — zero warnings allowed |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run format` | Prettier write |
| `npm run format:check` | Prettier check (used in CI) |
| `npm run typecheck` | TypeScript project references, no emit |
| `npm run test` | Vitest unit/component tests (watch mode) |
| `npm run test:coverage` | Vitest with V8 coverage report |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run test:e2e:ui` | Playwright with interactive UI |
| `npm run docker:dev` | `docker compose up --build` → http://localhost:5173 |
| `npm run db:types` | Regenerate `src/lib/supabase/database.types.ts` |
| `npm run superadmin` | SuperAdmin CLI interactive mode |
| `npm run superadmin:hash` | Generate bcrypt password hash for SuperAdmin CLI |
| `npm run superadmin:key` | Generate encryption key for SuperAdmin CLI |

---

## CI / Quality Gates

`.github/workflows/ci.yml` runs on every push:

1. `npm run format:check`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test` (Vitest)
5. `npm run build`
6. `npm run test:e2e` (Playwright)

Husky + lint-staged run ESLint and Prettier on staged files before every commit.

### Theming

Semantic CSS variables in `src/styles/index.css` are swapped by a `.dark` class on `<html>`. The choice (light/dark/system) is persisted in `themeStore` and applied by `useThemeEffect`.

### Errors and Logging

`src/lib/logger.ts` is the only module allowed to call `console`. Everything unexpected funnels through `reportError` (the future Sentry hook). `src/lib/api/errors.ts` normalises Postgrest/network failures into `ApiError` codes with user-facing copy, which the query client uses to decide what is retryable.

---

## Known Issues / Limitations

- **`npm audit`**: a high-severity advisory (`GHSA-qwww-vcr4-c8h2`) exists in `react-router` for RSC mode. This app is a client-side SPA and does not use RSC mode; the advisory does not apply. Revisit when a patched release ships.
- **Billing**: capability definitions exist in the RBAC map but no billing UI or API is implemented.
- **Reports/Export**: only a print placeholder route exists; no export logic.
- **Coach Feedback**: defined in the capability map; no UI or API.
- **Attendance status**: only `present` / `absent` are supported (no `late`).
- **Attendance trend chart** in PlayerDashboardPage uses hardcoded sample data (Jan–May labels) rather than real attendance history.

---

## Recommended Next Phase

> These items are **inferred** from placeholder feature directories, the RBAC capability map, and environment variable schema. They are not confirmed requirements.

### Phase A — Billing & Fees
- Fee configuration per batch (monthly rate, fee mode: `academy_pays` / `player_pays`)
- Fee payment tracking per player
- Owner billing overview

### Phase B — Coach Feedback
- Session-level coach notes per player
- Feedback history on player profile
- `feedback:read_own` and `feedback:write` capabilities are already defined

### Phase C — Reports & Exports
- PDF / CSV export of attendance, match scorecards, player stats
- `reports:export` capability is already assigned to player, coach, and owner roles
- Print layout route (`/print/placeholder`) is already in the router

### Phase D — Web Push Notifications
- Push via VAPID (`VITE_VAPID_PUBLIC_KEY` in env schema; `vite-plugin-pwa` installed)

### Phase E — Attendance Trend Chart
- Replace the hardcoded sample data in PlayerDashboardPage with real attendance history from the database

### Phase F — Advanced Stats UI
- Academy records page (schema and RPC exist)

