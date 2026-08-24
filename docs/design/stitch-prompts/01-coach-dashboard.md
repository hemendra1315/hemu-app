# Stitch Prompt — 01 · Coach Dashboard

**Screen:** Coach Dashboard
**Status:** ✅ Completed (approved Stitch artifact)
**Design viewport:** 390px mobile

---

## Objective
The coach's primary home screen joined into the Floodlit Turf + Scorebook language: a calm, at-a-glance command center for the day's coaching work.

## Design system
`docs/design/cricket-academy-stitch-design-system.md` — design-system asset ID **`a4001a0faef843968679f0b6bccf4485`**.

## Structure (top → bottom, 390px)
1. **App bar** — Manrope H1 screen title; bell / notification wear.
2. **Date / focus chip** — today's date in IBM Plex Mono, with saffron emphasis when a fixture is slated.
3. **Stat cards** — 2–4 quiet surface cards (sessions today, players, batches, attendance %). Surface `#FFFFFF`, 12px radius, quiet 1px `Line` border; numerals in IBM Plex Mono. No decorative charts.
4. **Today's schedule** — scorebook-ruled rows; each row shows time (Mono), batch name, and a turquoise status badge.
5. **Primary action** — **Turf** CTA (e.g. Mark Attendance / Create Session) alongside a quiet secondary surface action.

## Rules
- 4pt grid spacing; tokens per the design-system doc; no gradients or glass; no fake metrics.

## Functional note
Visual-only reference. Existing React behavior, routing, and coach data (`src/features/dashboard`) remain authoritative.