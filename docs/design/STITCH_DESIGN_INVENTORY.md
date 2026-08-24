# Stitch Design Inventory — Cricket Academy Manager

> **Document purpose:** Preserve every piece of completed Stitch design work for the Cricket Academy Manager redesign before any further UI changes are made. This is a **documentation / backup record only**.
>
> **Scope guardrails:**
> - No new Stitch screens are to be generated from this document.
> - No application code is modified.
> - Supabase, migrations, RLS, RPCs, routes, hooks, and business logic are **not** touched.
> - No existing files are deleted or overwritten.

---

## 1. Stitch Project Identity

| Field | Value |
|---|---|
| **Stitch project name** | Cricket Academy Manager |
| **Stitch Project ID** | `16106513707554699994` |
| **Design-system name** | Floodlit Turf + Scorebook |
| **Design-system asset ID** | `a4001a0faef843968679f0b6bccf4485` |
| **Target viewport** | **390px mobile** (mobile-first, primary design target) |

---

## 2. Completed Stitch Artifacts (Screens)

The following screens are **complete** and form the current backup set.

| # | Screen | Status | Prompt file |
|---|---|---|---|
| 1 | Coach Dashboard | ✅ Complete | `stitch-prompts/01-coach-dashboard.md` |
| 2 | Attendance | ✅ Complete | `stitch-prompts/02-attendance.md` |
| 3 | Batches | ✅ Complete | `stitch-prompts/03-batches.md` |
| 4 | Batch Details | ✅ Complete | `stitch-prompts/04-batch-details.md` |
| 5 | Sessions | ✅ Complete | `stitch-prompts/05-sessions.md` |
| 6 | Create Session | ✅ Complete | `stitch-prompts/06-create-session.md` |
| 7 | Players | ✅ Complete | `stitch-prompts/07-players.md` |
| 8 | Player Details | ✅ Complete | `stitch-prompts/08-player-details.md` |

---

## 3. Generation / Session IDs

| Screen | Generation / Session ID |
|---|---|
| Coach Dashboard | *Not recorded in this backup* |
| Attendance | *Not recorded in this backup* |
| Batches | *Not recorded in this backup* |
| Batch Details | *Not recorded in this backup* |
| Sessions | *Not recorded in this backup* |
| Create Session | *Not recorded in this backup* |
| Players | *Not recorded in this backup* |
| Player Details | *Not recorded in this backup* |

> **Note:** Stitch generation/session IDs were not captured at authoring time for the completed set above. If the underlying Stitch project is revisited, each screen's generation ID can be recovered from the Stitch project (Project ID `16106513707554699994`) and appended here. They are intentionally left blank rather than fabricated.

---

## 4. Completion Status

### ✅ Artifacts that ARE complete (generated)
1. Coach Dashboard
2. Attendance
3. Batches
4. Batch Details
5. Sessions
6. Create Session
7. Players
8. Player Details

### ⏭️ Artifacts that are NOT generated (planned / future)
1. **Members** — not yet generated (future work). Prompt scaffold prepared at `stitch-prompts/09-members-future.md`.

The **Members (future)** screen is scoped for a later pass. It is **not complete** and must not be treated as an approved artifact.

---

## 5. Authoritative Source of Truth

- **Existing React functionality is authoritative.** All functional behavior, data flow, routing, and business rules remain the responsibility of the current React codebase.
- **Stitch was used for visual design only.** Stitch artifacts represent **visual/UI design intent** — they define how screens *look* and feel on the 390px mobile viewport. They do **not** replace, override, or redefine any application behavior.

---

## 6. Relationship to the React App

The completed Stitch screens serve as **design reference** for the relevant feature areas in the React (Vite + TypeScript + Tailwind) app:

| Stitch screen | App feature / page reference |
|---|---|
| Coach Dashboard | `src/features/dashboard` — Coach Dashboard |
| Attendance | `src/features/attendance` — bulk attendance (mobile-first) |
| Batches | `src/features/batches` — batch list / CRUD |
| Batch Details | `src/features/batches` — batch detail & weekly schedule |
| Sessions | `src/features/sessions` — calendar + session list |
| Create Session | `src/features/sessions` — new session flow |
| Players | `src/features/players` — roster |
| Player Details | `src/features/players` — player profile |
| Members (future) | `src/features/members` — invite & role management |

> See `docs/FOLDER-STRUCTURE.md` in this repo for the canonical app architecture.

---

## 7. Implementation Roadmap

The design system and screens below are the approved visual foundation. Suggested sequence for any future visual implementation work:

1. **Adopt the design system** — apply `cricket-academy-stitch-design-system.md` tokens (color, type, spacing, geometry, rules) to the React styling layer.
2. **Reconcile per-screen references** — map each completed Stitch screen to its matching feature page (table in §6).
3. **Coach Dashboard first** — the highest-frequency coach landing screen; establish the Floodlit Turf + Scorebook rhythm there.
4. **Batches → Batch Details** sequence — batch list, then the richer detail/schedule view.
5. **Sessions → Create Session** sequence — calendar/list then creation flow.
6. **Players → Player Details** sequence — roster then profile.
7. **Attendance** — mobile-first bulk marking; validate 390px touch targets.
8. **Members (future)** — only after the above are landed; requires a fresh approved prompt and a new Stitch pass.

Each step preserves existing React functionality; Stitch visuals are layered as styling, not behavior.

---

## 8. Related Files

- `cricket-academy-stitch-design-system.md` — the complete approved design system.
- `stitch-prompts/` — one prompt file per completed screen (plus one future scaffold).
- `stitch-screens/README.md` — index for exported screen art/preview assets.

---

*Recorded as a backup snapshot. All values above are preserved from the approved Stitch pass and are not modified in place by any subsequent UI work.*