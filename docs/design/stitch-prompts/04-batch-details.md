# Stitch Prompt — 04 · Batch Details

**Screen:** Batch Details
**Status:** ✅ Completed (approved Stitch artifact)
**Design viewport:** 390px mobile

## Objective
The rich detail view of one batch (roster, weekly schedule, coach assignment) in the Floodlit Turf + Scorebook language.

## Design system
`cricket-academy-stitch-design-system.md` — design-system asset ID **`a4001a0faef843968679f0b6bccf4485`**.

## Layout (390px)
1. **Header** — batch name (Manrope H1); meta line of venue, coach, frequency (time in Mono).
2. **Stat strip** — quiet surface cards: active players, sessions, attendance % (Plex Mono numerals).
3. **Tabs / sections** — Roster · Schedule · Sessions as quiet labels with scorecard-rule underline.
4. **Roster block** — player rows (name + mono id), 44px touch targets, hair-divided rows.
5. **Primary action** — **Turf** CTA ("New session" / "Mark attendance").

## State
Selected rows use Turf pale `#E7F3EC`; Saffron used sparingly for key status.

## Note
Visual only. Schedule editor, capacity checks, and roster logic live in `src/features/batches`.