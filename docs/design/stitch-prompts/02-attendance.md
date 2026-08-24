# Stitch Prompt — 02 · Attendance

**Screen:** Attendance
**Status:** ✅ Completed (approved Stitch artifact)
**Design viewport:** 390px mobile

## Objective
Mobile-first bulk attendance kept fast (a coach marks a 30-player session in <60s), styled with the Floodlit Turf + Scorebook system.

## Design system
`cricket-academy-stitch-design-system.md` — design-system asset ID **`a4001a0faef843968679f0b6bccf4485`**.

## Layout (390px)
1. **Screen title** — Manrope H1 "Attendance".
2. **Session / batch selector** — quiet input, Turf focus; time in IBM Plex Mono.
3. **Roster rows** — each player a 44px+ touch row; Present/Absent toggles as large tap targets; scorecard hair-lines divide rows.
4. **Bulk action bar** — sticky bottom "Mark all / Clear" plus primary **Turf** Save with a live count (Mono, e.g. `12/14`).
5. **Semantic states** — Success `#218A5B` (present) / Error `#C4493D` (absent).

## Rules
- Touch target min 44px; no decorative styling; rows separated by scorecard-inspired quiet rules.

## Constraints
Visual only. Offline queue + audit behavior in `src/features/attendance` is authoritative.