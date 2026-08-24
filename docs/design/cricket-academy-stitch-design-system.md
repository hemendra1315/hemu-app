# Cricket Academy Manager — Approved Design System

> **Name:** Floodlit Turf + Scorebook
> **Design-system asset ID:** `a4001a0faef843968679f0b6bccf4485`
> **Stitch Project ID:** `16106513707554699994`
> **Target viewport:** 390px mobile (mobile-first)

This document is the **complete, approved** visual design system for the Cricket Academy Manager Stitch redesign. It is the single source of truth for the "Floodlit Turf + Scorebook" look and must be preserved in full before any further UI changes are made.

---

## 1. Visual Language

**Floodlit Turf + Scorebook**

The product is a cricket academy coach's mobile companion, designed to be used pitch-side under floodlights at dusk. The language fuses:

- **Floodlit Turf** — deep green grounds, a pitch-floor calm, high-contrast lighting, and warm floodlight golden accents. Surfaces read like turf under lights: deep ink-green bases, bright turf fields, and a chalk-white canvas thickened only where it matters.
- **Scorebook** — the disciplined, quiet instruments of the sport: scorecard dividers, fine ruled lines, monospaced numbers, and ink applied with restraint.

The result: a calm, credible, sport-native interface that never looks like a generic SaaS dashboard.

---

## 2. Colors

### Core palette

| Token | Hex | Role |
|---|---|---|
| **Ink** | `#10201B` | Primary text, icons, strong strokes |
| **Turf** | `#0B6B4B` | Primary action, brand green |
| **Turf dark** | `#074735` | Pressed/pushed states, deep accents |
| **Turf pale** | `#E7F3EC` | Brand-tinted surfaces, selected rows |
| **Chalk** | `#F7F8F4` | App background (canvas) |
| **Surface** | `#FFFFFF` | Cards, sheets, work surfaces |
| **Line** | `#D9E2DB` | Quiet 1px dividers, scorecard rules |
| **Muted** | `#65736C` | Secondary text, captions, identifiers |

### Accent & semantic palette

| Token | Hex | Role |
|---|---|---|
| **Saffron** | `#E39A32` | Floodlight accent, highlights, key status |
| **Saffron pale** | `#FFF3DA` | Saffron-tinted surfaces, badges |
| **Success** | `#218A5B` | Positive states (present, paid, done) |
| **Warning** | `#B86B16` | Caution states (partial, rescheduled) |
| **Error** | `#C4493D` | Negative states (absent, failed) |
| **Info** | `#2A6F9B` | Informational accents |

### Dark theme palette (floodlit night surfaces)

| Token | Hex | Role |
|---|---|---|
| **Dark background** | `#0D1713` | Dark-mode canvas |
| **Dark surface** | `#14221C` | Dark-mode cards/sheets |
| **Dark line** | `#294138` | Dark-mode dividers |
| **Dark text** | `#F4F7F1` | Dark-mode primary text |

---

## 3. Typography

| Usage | Family | Notes |
|---|---|---|
| **Headings / display** | **Manrope** | Screen titles, section headers |
| **Operational / body text** | **IBM Plex Sans** | Body copy, controls, labels |
| **Counts, times, identifiers** | **IBM Plex Mono** | Numbers, timestamps, batch codes, session counts — scorebook numerals |

### Type scale

| Style | Size / Line height | Typical use |
|---|---|---|
| **H1** | 28 / 34 | Screen title |
| **H2** | 22 / 28 | Section header |
| **H3** | 17 / 22 | Card title, list header |
| **Body** | 15 / 22 | Default reading text |
| **Label** | 12 / 16 | Field labels, tab labels, small headings |
| **Caption** | 12 / 17 | Helper text, metadata, identifiers |

---

## 4. Spacing

Standard scale, applied as a 4pt base grid:

**4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 px**

---

## 5. Geometry

| Property | Value |
|---|---|
| Card / work-surface radius | **12px** |
| Input / button radius | **10px** |
| Minimum touch target | **44px** |
| Borders | **Quiet 1px borders** |
| Shadows | **Minimal shadows** |

---

## 6. Design Rules

- **No gradients**
- **No glassmorphism**
- **No blobs**
- **No oversized cards**
- **No decorative charts**
- **No fake metrics**
- **No generic SaaS dashboard styling**
- **No unnecessary animation**
- **No decorative cricket imagery** (icons/imagery only where functional)
- **Use scorecard-inspired dividers** — thin, quiet, ruled lines that separate content like scorebook columns
- **Use saffron accents sparingly** — only for emphasis and key status moments, like floodlights picking out the wickets column

---

## 7. Application Guidance

1. Everything renders against **Chalk** (`#F7F8F4`) on a **390px mobile** viewport.
2. Cards sit on **Surface** white with **12px** radius and quiet **1px** `Line` borders; shadows are minimal.
3. Primary actions use **Turf**; pressed states use **Turf dark**.
4. Numbers that carry meaning (counts, times, identifiers) are set in **IBM Plex Mono** per the scorebook rule.
5. Dividers follow scorecard logic — modest, uniform, ink-light rules.
6. Dark surfaces (Dark background/surface/line/text) exist for floodlit-night contexts and must preserve the same hierarchy.

---

*Complete and untouched copy of the approved "Floodlit Turf + Scorebook" design system. Preserved for the Stitch redesign record.*