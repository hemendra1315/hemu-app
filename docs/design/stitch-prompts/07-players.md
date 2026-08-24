# Stitch Prompt — 07 · Players

**Screen:** Players
**Status:** ✅ Completed (approved Stitch artifact)
**Design viewport:** 390px mobile

## Objective
The academy player roster rendered in the Floodlit Turf + Scorebook language — a clean, scannable scorebook of names.

## Design system
`cricket-academy-stitch-design-system.md` — asset ID `a4001a0faef843968679f0b6bccf4485`.

## Layout (390px)
1. **Title** — Manrope H1 "Players".
2. **Search / filter bar** — quiet input; count chip showing roster size (`42` in Mono).
3. **Player list** — surface-white rows (12px radius on the sheet, 1px Line borders). Each row shows: avatar, full name (Body), batch chip + join status, and identifiers in Plex Mono.
4. **Row states** — Turf pale `#E7F3EC` for an active/accepted row; muted for pending.

## Rules
- Normal cell-oriented, low-UI overhead; no oversized cards; mono identifiers.

## Constraint
Visual only; `src/features/players` owns roster, profile, and approvals queue.