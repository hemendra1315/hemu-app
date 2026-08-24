# Stitch Prompt — 05 · Sessions

**Screen:** Sessions
**Status:** ✅ Completed (approved Stitch artifact)
**Design viewport:** 390px mobile

## Purpose
A scorebook-style run of upcoming and past training sessions for a coach, in the Floodlit Turf + Scorebook system.

## Design system
`cricket-academy-stitch-design-system.md` — design-system asset ID `a4001a0faef843968679f0b6bccf4485`.

## Layout (390px)
1. **Title** — Manrope H1 "Sessions".
2. **Date rail / calendar chip** — horizontal date selector (mono day numbers); today emphasized with Turf; quiet 1px lines.
3. **Session list** — surface cards, 12px radius, 1px `Line` border. Each row: date + time (Mono), batch name, coach, status badge (Completed / Upcoming / Rescheduled) using Success/Warning tokens.
4. **Sticky action** — **Turf** "Create session".

## Rules
- H3 card titles, Body 15/22, Caption 12/17.
- Scorecard dividers; no decorative charts; mono for timed values.

## Constraint
Visual only; `src/features/sessions` owns materialization, reschedule, and cancel.