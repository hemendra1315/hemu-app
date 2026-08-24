# Stitch Prompt — 06 · Create Session

**Screen:** Create Session
**Status:** ✅ Completed (approved Stitch artifact)
**Design viewport:** 390px mobile

## Purpose
A focused creation form for a single training session — the finest score-entry page — in Floodlit Turf + Scorebook.

## Design system
`cricket-academy-stitch-design-system.md` — asset ID `a4001a0faef843968679f0b6bccf4485`.

## Layout (390px)
1. **Title** — Manrope H1 "Create session".
2. **Form sheet** — Surface-white card, quiet 1px `Line` border, 12px radius.
   - Batch selector (Input 10px radius, 44px).
   - Date + time inputs (time in IBM Plex Mono); labels Label 12/16.
   - Recurrence selector (chips / quiet selects).
   - Notes (optional).
3. **Validation** — Error `#C4493D` for invalid, Success `#218A5B` for valid.
4. **Bottom bar** — secondary "Cancel" + primary **Turf** "Create session".

## Rules
No gradients, no heavy decorations, 4pt spacing.

## Functional note
Visual only; `src/features/sessions` owns creation and recurrence materialization.