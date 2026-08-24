# Stitch Prompt — 08 · Player Details

**Screen:** Player Details
**Status:** ✅ Completed (approved Stitch artifact)
**Design viewport:** 390px mobile

## Objective
The individual player profile — contact, batch, attendance, and feedback timeline — in the Floodlit Turf + Scorebook language.

## Design system
`cricket-academy-stitch-design-system.md` — asset ID `a4001a0faef843968679f0b6bccf4485`.

## Layout (390px)
1. **Header** — avatar + name (Manrope H1/H2), role/batch chip, mono identifier.
2. **Stat strip** — attendance %, sessions, position in Plex Mono numerals on quiet surface cards.
3. **Detail rows** — contact, batch, coach with quiet scorecard rules.
4. **History / timeline** — attendance and feedback grouped, rows hair-divided.

## States
- Present = Success `#218A5B`; Absent = Error `#C4493D`.
- Feedback rating highlights use Saffron `#E39A32` sparingly.

## Constraints
Visual only; `src/features/players` holds profile data and stats math.