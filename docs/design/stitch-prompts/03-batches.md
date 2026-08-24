# Stitch Prompt — 03 · Batches

**Screen:** Batches
**Status:** ✅ Completed (approved Stitch artifact)
**Design viewport:** 390px mobile

## Objective
The coach's training-batch list rendered as a scorebook-style column list in the Floodlit Turf + Scorebook language.

## Design system
`cricket-academy-stitch-design-system.md` — asset ID **`a4001a0faef843968679f0b6bccf4485`**.

## Layout (390px)
1. **Title** — Manrope H1 "Batches".
2. **Primary action** — quiet-but-visible **Turf** "New batch".
3. **Batch list** — surface-white cards (12px radius, 1px `Line` border) each showing: batch name (Body/H3), schedule summary (day + time in Mono), coach chip, and roster count (`18` in Plex Mono).
4. **Counts / identifiers** — always IBM Plex Mono (scorebook numerals).

## Rules
- One-two line metadata; quiet hair dividers; no oversized cards; no gradients or decorative garnish.

## Notes
Visual only; `src/features/batches` remains authoritative for CRUD, schedules, and capacity.