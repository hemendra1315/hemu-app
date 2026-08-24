# Cricket Academy Manager — Product Requirements Document (PRD)

Version: 1.0 (for approval)
Stack: React + TypeScript + Tailwind CSS + Supabase (PostgreSQL, Auth, Storage, Edge Functions, Realtime)

---

## 1. Product Summary

A multi-tenant SaaS web app for cricket academies in India to manage coaches, players, batches, sessions, attendance, drills, feedback, match stats (via CricHeroes), payments (₹200/month per student), reports and notifications.

**Tenant = Academy.** Every domain row is scoped to an `academy_id`. Users may hold roles in multiple academies.

### 1.1 Goals
- Owner can run day-to-day academy ops in < 10 min/day.
- Coach can mark attendance for a session in < 60 seconds on mobile.
- Player/parent sees schedule, attendance %, feedback, stats, and dues.
- Zero cross-academy data leakage (enforced in DB via RLS, not just UI).

### 1.2 Non-Goals (v1)
- Native mobile apps (PWA only; push via Web Push/FCM).
- Public academy marketplace / discovery.
- Live ball-by-ball scoring (CricHeroes is the source of truth).
- Payroll, GST invoicing beyond simple receipts.

### 1.3 Success Metrics
| Metric | Target (90 days) |
|---|---|
| Attendance marked per scheduled session | ≥ 90% |
| Monthly subscription collection rate | ≥ 85% by day 10 |
| Coach weekly active | ≥ 80% |
| Report export usage per academy/month | ≥ 4 |

---

## 2. Personas & Roles

| Role | Scope | Description |
|---|---|---|
| **Super Admin** | Platform | Platform staff. Manages academies, plans, pricing, feature flags, impersonation (audited), global reports. |
| **Academy Owner** | One academy (can own several) | Full control of one academy: coaches, batches, players, approvals, fees mode, payments, reports, settings. |
| **Coach** | Assigned batches | Sessions, attendance, drills, feedback, batch player list, batch reports. |
| **Player** | Self | Own profile, join academy via code, schedule, attendance, feedback, stats, payments/renewal. |

Optional `Parent/Guardian` is modeled as a *linked contact* on the player (email/phone) in v1, not a separate login.

### 2.1 Permission Matrix (summary)

| Capability | Super Admin | Owner | Coach | Player |
|---|:-:|:-:|:-:|:-:|
| Create academy | ✔ | ✔ (own) | ✖ | ✖ |
| Edit academy settings / fee mode | ✔ | ✔ | ✖ | ✖ |
| Regenerate join code | ✔ | ✔ | ✖ | ✖ |
| Approve/reject join requests | ✔ | ✔ | ✖ | ✖ |
| Invite / manage coaches | ✔ | ✔ | ✖ | ✖ |
| CRUD batches | ✔ | ✔ | ✖ (view assigned) | ✖ |
| Assign player ↔ batch | ✔ | ✔ | ✖ | ✖ |
| CRUD sessions | ✔ | ✔ | ✔ (own batches) | ✖ |
| Mark attendance | ✔ | ✔ | ✔ (own batches) | ✖ |
| CRUD drills (academy library) | ✔ | ✔ | ✔ | ✖ |
| Write feedback | ✔ | ✔ | ✔ | ✖ |
| Read feedback | ✔ | ✔ | ✔ (authored/batch) | ✔ (own) |
| Link CricHeroes team/player | ✔ | ✔ | ✖ | ✖ |
| View player stats | ✔ | ✔ | ✔ (own batches) | ✔ (own) |
| Export reports | ✔ | ✔ | ✔ (own batches) | ✔ (own only) |
| Record/verify payments | ✔ | ✔ | ✖ | ✖ (pays own) |
| Manage platform plans | ✔ | ✖ | ✖ | ✖ |

Permissions are enforced at three layers: **RLS policies (authoritative)** → **Edge Function/RPC checks** → **UI gating (`<Can/>` component)**.

---

## 3. Feature Requirements

### F1. Multi-Academy Support
- An academy has profile (name, logo, city, timezone, contact), settings, join code, fee mode, subscription plan.
- A user's memberships live in `academy_members` (`user_id`, `academy_id`, `role`, `status`).
- UI has an **academy switcher**; the active academy is persisted per user and sent as context to all queries.
- Acceptance: a user with roles in 2 academies sees strictly disjoint data per selection; RLS test suite proves no leakage.

### F2. Google Sign-In
- Supabase Auth with Google OAuth as the primary provider; email magic-link as fallback.
- On first login a `profiles` row is created via DB trigger (name, avatar, email).
- Post-login routing: 0 memberships → onboarding (join with code / create academy); 1 → that academy's dashboard; >1 → academy chooser.
- Acceptance: new Google user reaches onboarding in ≤ 2 screens; profile auto-populated.

### F3. Academy Join Code
- 6–8 char human-friendly code (Crockford base32, no ambiguous chars), unique, regenerable, optionally expiring, optionally usage-capped.
- Player enters code → creates a `join_requests` row (status `pending`) → owner notified.
- Invalid/expired/capped code → clear error; rate-limited (5 attempts / 10 min / user).
- Acceptance: code lookup is O(1) unique-indexed; regeneration invalidates the old code immediately.

### F4. Owner Approval for Players
- Owner sees a queue of pending requests (name, age, contact, preferred batch, note).
- Approve → creates `academy_members(role='player', status='active')` + `players` row + optional batch assignment + starts subscription cycle. Reject → status `rejected` with reason. Both notify the player.
- Acceptance: approval is a single transactional RPC; no partially-created player.

### F5. Batches & Multi-Batch Players
- Batch: name, age group, skill level, coach(es), venue, weekly recurring schedule (weekday + start/end time), capacity, active flag.
- `batch_players` join table gives many-to-many with `joined_at`/`left_at` history.
- Capacity warnings; cannot add a player twice to the same active batch.
- Acceptance: a player in 3 batches sees a merged schedule with no duplicates and per-batch attendance %.

### F6. Coach Management
- Owner invites coach by email (invite token) or approves a coach join request; assigns coaches to batches (`batch_coaches`).
- Coach profile: specialization, certifications, bio, availability.
- Deactivating a coach revokes access but retains authored history.

### F7. Session Scheduling
- Sessions generated from a batch's recurrence for a horizon (default 8 weeks) via a scheduled job, plus manual one-off sessions.
- Fields: date, start/end, venue, coach, focus area, planned drills, status (`scheduled|completed|cancelled`), cancellation reason.
- Reschedule/cancel notifies the batch. Conflict detection for coach/venue overlap (warn, allow override by owner).
- Acceptance: editing a recurrence offers "this session only" vs "all future sessions".

### F8. Session-wise Attendance
- Per session, per enrolled player: `present | absent | late | excused`, plus arrival time and note.
- Bulk "mark all present", offline-tolerant (optimistic UI + retry queue), edit window (default 48h, owner-configurable), all edits audited.
- Attendance % per player per batch per period; absence-streak alert (default 3) notifies owner + player.
- Acceptance: 30-player attendance submitted in one batched write; idempotent on retry.

### F9. Training Drills
- Academy drill library: name, category (batting/bowling/fielding/fitness/keeping), description, duration, equipment, difficulty, video/image (Supabase Storage), tags.
- Drills attached to a session plan (`session_drills`, ordered, with per-drill notes) and optionally per-player load/result.
- Platform-level starter drills are copy-on-use into an academy's library.

### F10. Coach Feedback
- Feedback on a player: optional session link, ratings (1–5 across technique/fitness/discipline/game-sense), strengths, improvements, private-to-staff note, visible flag.
- Player sees only feedback with `is_visible_to_player = true` (private note never exposed by RLS column policy/view).
- Feedback timeline + rating trend chart.

### F11. CricHeroes Integration (academy-only)
- Academy Owner links the academy's CricHeroes team/profile URLs; players are mapped to CricHeroes player identities (`cricheroes_links`).
- Ingestion is via an Edge Function `cricheroes-sync` that fetches/parses **only the academy's own** public team/match pages, or accepts a CSV/manual entry fallback. Raw payloads stored in `cricheroes_raw_imports`; normalized rows into `matches` / `match_performances`.
- Nightly sync + manual "Sync now"; sync log with status and errors; no data from non-linked academies is imported.
- Risk/assumption to confirm: CricHeroes has no documented public API — v1 ships **manual link + CSV/manual entry** as the guaranteed path, with scraping behind a feature flag subject to ToS review.

### F12. Player Statistics
- Derived from `match_performances` (runs, balls, SR, 4s/6s, dismissal, overs, wickets, economy, catches/run-outs) plus academy-side metrics (attendance %, sessions attended, drill load, feedback averages).
- Aggregated in SQL views/materialized views: career totals, last-5-match form, per-season splits.
- Player profile shows charts (runs trend, SR, wickets, attendance).

### F13. Reports (PDF / Excel)
- Report types: attendance register (batch × month), player progress card, batch performance, fee collection/outstanding, coach activity, academy summary.
- Excel via `exceljs`, PDF via server-side render in an Edge Function (`react-pdf`/`pdf-lib`); generated file stored in Storage; signed URL returned; jobs tracked in `report_jobs` (queued→processing→ready→failed).
- Acceptance: 12-month attendance register for 200 players generates in < 20s and downloads via signed URL.

### F14. Push Notifications
- Web Push (VAPID) + in-app notification center + optional email fallback.
- Events: join request received/approved/rejected, session created/rescheduled/cancelled, session reminder (T-2h), attendance marked absent, new feedback, payment due (T-3, due date, overdue), payment received, subscription expiring.
- Per-user, per-event-type preferences and quiet hours; device tokens in `push_subscriptions`; fan-out via Edge Function + `notifications` table.

### F15. Subscriptions & Payments (₹200/month per student)
- Price is a platform default (₹200) overridable per academy/per player (scholarship/discount).
- **Fee mode per academy**: `academy_pays` (owner is billed for the count of active students) or `player_pays` (each player pays their own).
- Monthly cycle per player: `subscriptions` (start, current period, status `active|grace|expired|cancelled`) with `invoices` generated by a scheduled job on the cycle date.
- **Flexible renewal**: pay for 1/3/6/12 months (prepaid months extend `period_end`), partial payments allowed (invoice `partially_paid` with `amount_due` remaining), configurable grace period (default 7 days), pro-rata for mid-month joins, pause/hold for injury.
- Payment methods: online (Razorpay/Stripe via Edge Function + webhook; **decision needed — recommend Razorpay for INR/UPI**) and offline (cash/UPI recorded by owner, marked `verified_by`).
- Ledger: `payments` (immutable), `invoices`, `payment_allocations`; receipts as PDF; outstanding dues dashboard + reminders.
- Acceptance: no double-charging on webhook retries (idempotency key on provider payment id); ledger always reconciles (`sum(allocations) = invoice.amount_paid`).

### F16. Dashboards
- **Super Admin**: academies, MRR, active students, churn, failed syncs/jobs.
- **Owner**: today's sessions, attendance % (7/30d), pending approvals, outstanding dues, active players/coaches, upcoming renewals.
- **Coach**: today's/next sessions, quick-mark attendance, players needing attention (low attendance / low ratings), feedback pending.
- **Player**: next session, attendance %, latest feedback, dues + Pay now, recent match stats.

### F17. Cross-cutting
- Audit log for all privileged mutations; soft delete (`deleted_at`) on core entities.
- i18n-ready (en + hi), Asia/Kolkata default timezone, all timestamps stored UTC (`timestamptz`).
- Accessibility WCAG 2.1 AA; mobile-first PWA, installable, offline read cache for schedule + attendance queue.
- Rate limiting on join-code and payment endpoints; secrets only in Edge Function env.

---

## 4. Key User Flows
1. **Player onboarding**: Google sign-in → enter join code → fill profile → pending screen → owner approves → assigned to batch(es) → dashboard.
2. **Coach attendance**: dashboard → today's session → roster → mark all present → adjust exceptions → submit → absent players notified.
3. **Owner monthly billing**: job generates invoices on the 1st → reminders T-3/T-0/overdue → player pays online (or owner records cash) → receipt issued → dues dashboard updates.
4. **Reporting**: owner picks report + range → job queued → notification when ready → download PDF/Excel.

---

## 5. Open Decisions (need your approval)
1. Payment gateway: **Razorpay** (recommended, UPI/INR) vs Stripe.
2. CricHeroes: manual/CSV only in v1, scraping behind a flag? (ToS risk)
3. Parent as separate login role in v1, or contact-only (recommended)?
4. Push: Web Push only (PWA) vs also FCM for future native apps.
5. Multi-academy player: allowed (recommended) or restricted to one academy?
