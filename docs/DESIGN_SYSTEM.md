# HiCap Prep — Design System

Extracted from `docs/design/design_handoff_level13_prep/` (Claude Design's
handoff). This file is the authoritative source of tokens and component
patterns for `src/app.html`. When the design handoff and this document
disagree, this document wins — the design handoff was written for a hosted
Level 13 Prep bundle and predates the HiCap Prep rebrand and the grade
picker on the roster.

Everything below is implemented as CSS custom properties on `:root` in
`src/app.html`, then referenced by short-named utility classes. No CSS
framework, no build step, no preprocessor.

---

## 1. Color

### Base palette

| Token | Hex | Role |
| --- | --- | --- |
| `--bg` | `#fffdf9` | Page ground (warm off-white) |
| `--surface` | `#fff0e3` | Warm mat: sticky bars, keypad keys, nonverbal question stem panel |
| `--ink` | `#1d1b2e` | Body text, app header background |
| `--divider` | `#e4d9cc` | Every hairline rule and default border, 1px |
| `--flare` | `#f2621f` | **Primary.** Actions, progress, verbal strand |
| `--lagoon` | `#0fb3a5` | Quantitative strand, timers |
| `--violet` | `#6d4aff` | Nonverbal strand, badges |

### Strand ramps

Only the strand a color belongs to may use it. Verbal = flare, quant =
lagoon, nonverbal = violet. Never mix.

```
--flare-100  #fff1e6   fills, tints, hovers
--flare-200  #ffd7b8   secondary fills
--flare-300  #ffb075   borders on tint
--flare-400  #fb8640
--flare-500  #f2621f   base (buttons, links, focus)
--flare-600  #d9470b
--flare-700  #ad3506   captions on light ground
--flare-800  #7d2504   body text on tint (>= 4.5:1 contrast)
--flare-900  #4a1603   initials, deepest ink-on-tint

--lagoon-100 #e2fbf7
--lagoon-200 #b4f2e9
--lagoon-300 #6fe2d3
--lagoon-400 #2fcbba
--lagoon-500 #0fb3a5
--lagoon-600 #089184
--lagoon-700 #067168
--lagoon-800 #04514a
--lagoon-900 #02322e

--violet-100 #efeaff
--violet-500 #6d4aff
```

Only lagoon and flare need full ramps in the app today — violet gets 100
and 500 (badges + nonverbal strand). Grow the ramp if a new violet
surface actually needs a step.

### Neutral ramp

```
--neutral-100 #fbf7f2   header text on ink
--neutral-200 #f2ebe2
--neutral-300 #e2d7c9
--neutral-400 #c4b6a6   disabled borders, dashed empty-state
--neutral-500 #9d8f80   disabled glyphs, second-line meta on darker tints
--neutral-600 #7c6f62   captions
--neutral-700 #5d5245   secondary body text
--neutral-800 #3b3345   body text on tint
--neutral-900 #231f37   deepest, nearly `--ink`
```

### Usage rules (these matter more than the ramps themselves)

- **100–200 for tinted fills and hovers, 500 as the base, 700–900 for
  text sitting on a tint.** Body-size text never uses 500 on the light
  ground — use 700/800.
- **Correct/incorrect are never red and green.** Correct = the
  question's strand color filled + white glyph. Incorrect = a hollow
  ring in the strand color + a `--flare-800` underline on the
  "Correct answer:" line. Nothing in the app is alarm-colored.
- Disabled controls drop to `opacity: 0.45` and use
  `--neutral-500`/`--neutral-600` for their glyphs and text.

---

## 2. Typography

Google Fonts: **Cormorant Garamond** (400, 600) for headings, numerals,
and buttons; **Lora** (400) for body. Loaded via `<link>` in
`src/app.html`. Self-host in production.

CSS variables:

```
--font-heading: "Cormorant Garamond", Georgia, "Source Serif Pro", serif;
--font-body:    "Lora", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
```

### Type scale

| Role | Size / weight / family | Where |
| --- | --- | --- |
| **Display** | 42px / 400 / Cormorant, `letter-spacing: -0.02em` | Page title, results score |
| **Heading** | 25px / 600 / Cormorant | Screen titles |
| **Subhead** | 17px / 600 / Cormorant | Week rows, card titles |
| **Body** | 15px / 400 / Lora, `line-height: 1.5–1.6` | Question stems, roster names |
| **Small** | 13px / 400 / Lora | Rows, answer options, table cells |
| **Caption** | 11px / 400 / Lora, `letter-spacing: 0.14em`, uppercase | Section labels, kickers, statuses |
| **Figure** | Cormorant, `font-variant-numeric: tabular-nums` | Every number: 38/70, the ring percentage, the mock clock (52px), scores |

Rules:
- Headings cap at semibold — never bold.
- Display sizes set at 400 (Cormorant reads heavier than sans at the same
  weight; 400 is the intended weight for both display and running body).
- Every figure gets `font-variant-numeric: tabular-nums`. Running prose
  does not.

---

## 3. Spacing

A 4.6px-based scale (design system density is 1.15×). Applied via CSS
custom properties, never a raw pixel value.

```
--space-1  4.6px    hairline gaps, row insets
--space-2  9.2px    inside rows, between buttons
--space-3  13.8px   panel padding, gaps in a row
--space-4  18.4px   screen gutter, header padding
--space-6  27.6px   between blocks on a screen
--space-8  36.8px   section breaks
```

If a value isn't on the scale, it's a bug — pick the nearest step, don't
invent one.

---

## 4. Radius, elevation, borders

- **Radius:** `--radius-sm: 2px` (chips), `--radius-md: 4px` (buttons,
  inputs, cards, panels, keypad keys), `--radius-lg: 7px` (modal),
  `50%` (avatars, badge chips).
- **Elevation** is used **twice in the whole app**: the sticky bottom
  action bar and the running-mock panel. Both use
  `--shadow-md: 0 3px 10px rgba(45,43,43,0.16)`. Everything else is
  separated by a 1px divider rule.
- **Default border** everywhere: `1px solid var(--divider)`.
  **Active/selected:** `1px solid var(--flare)` + `inset 0 0 0 1px
  var(--flare)` + `var(--flare-100)` fill.

---

## 5. Icons

Lucide, 1.5px stroke, 18px at interface size (16px inline, 14px in
buttons, 26px for feature icons). One set only — no emoji, no second
icon family. Every icon in use inlined as SVG (no dependency, no request):

- `flame` — streak
- `lock` — parent area, locked days
- `check` — done, correct
- `chevron-down` — expand, collapse
- `chevron-left` — back
- `arrow-right` — start, next, roster row
- `clock` — timer
- `award` — badges
- `loader` — spinner (rotates 360° over 0.9s linear infinite)

---

## 6. Component states

Every interactive element defines all of the following.

### Buttons — outlined, never solid-filled

| Intent | Default |
| --- | --- |
| **Primary** | `1px solid var(--flare)`, text `var(--flare)`, transparent fill |
| **Secondary** | `1px solid var(--divider)`, text `var(--ink)` |
| **Ghost** | no border, text `var(--flare)`, reduced inline padding |
| **Destructive** | secondary shape, `var(--flare-800)` border and text (used for "End test") |

States (identical across intents):

- **Hover:** fill with the accent at 12% alpha (secondary: ink at 7%).
- **Active/pressed:** accent at 22% (secondary: ink at 14%).
- **Focus-visible:** `outline: 2px solid var(--flare); outline-offset: 2px`.
  Never the browser default.
- **Disabled:** `opacity: 0.45`, `cursor: not-allowed`, no hover.
- **Loading:** disabled, `opacity: 0.7`, label swaps to the gerund
  ("Scoring"), 14px spinner rotating 360° over 0.9s linear, infinite.

Sizes: minimum button height **44px**; primary CTAs **48px**.

### Input — one style only

Full width, min-height 36px (44–48px where a student types), transparent
fill, `1px solid var(--divider)`, radius 4px, 14px text, caret in
`var(--flare)`. Hover darkens the border; focus-visible switches the
border to `var(--flare)` with `outline-offset: 0`. Label above at 12px,
70% ink opacity.

### Card / panel

Transparent fill, `1px solid var(--divider)`, radius 4px, `--space-3`
padding, column flex with `--space-2` gaps. **Tinted variant** swaps in
`var(--flare-100)` fill + `var(--flare-300)` border — used for the
streak panel.

### Toggle switch

52×30px pill, 22px knob. Off: transparent fill, `var(--neutral-400)`
border, `var(--neutral-500)` knob. On: `var(--flare)` at 14% fill,
`var(--flare)` border, `var(--flare)` knob.

### Answer option

Full-width button, `--space-3` padding, min-height 56px, radius 4,
`1px solid var(--divider)`, left-aligned. Multiple-choice options prefix
a 26px circular letter badge (A–D) — Cormorant 13px, `var(--neutral-400)`
border, `var(--neutral-700)` letter — then the option text at 14px/1.5.

**Selected:** `var(--flare-100)` fill, `var(--flare)` border, `inset 0 0
0 1px var(--flare)`, `var(--flare-800)` text, letter badge border and
letter both switch to `var(--flare)` / `var(--flare-800)`.

---

## 7. Navigation shell

Persistent across every screen so the app reads as one product.

### Header bar (always visible)

- Background `var(--ink)`, 1px `var(--flare-800)` bottom border.
- **Left:** wordmark "HiCap Prep" (Cormorant 600, 16px, `var(--flare-300)`).
  Adapted from the design's "Level 13" wordmark for this project's brand.
- **Right (when a student is selected):** the current student's chip —
  26px circular avatar filled `var(--flare-400)` with `var(--flare-900)`
  initials, then the first name at 13px in `var(--neutral-100)`. Tapping
  it returns to the roster (switch student). Hidden when no student.
- **Far right:** a 44×44 icon button with the `lock` glyph,
  `var(--flare-700)` border, `var(--flare-300)` glyph. Opens the parent
  area (PIN gate → parent dashboard).

### Tab row (only on the three student screens)

Directly below the header. **Today · The route · Board.** Each tab is a
48px-min flex-1 button. **Active** tab: `var(--flare-100)` fill, 3px
`var(--flare-500)` bottom border, `var(--flare-800)` label. **Inactive**
labels: `var(--neutral-700)`. Cormorant 600, 14px.

The design specifies exactly three tabs. Two extra flows — **Browse
material** (study mode with answers shown) and **My history** — sit as
secondary links on the Today screen, not as extra tabs.

### Back pattern

Screens outside the tab set (quiz, results, PIN, browse, history, free
practice) use a left-aligned ghost "Back" button with a `chevron-left`
in the row directly under the header. Quiz back goes to the previous
question, or to Today from question 1. Parent area exits via a "Lock"
ghost button in its own header row.

---

## 8. Adaptations from the design handoff

The design was drafted before this project's actual scope was finalized.
Three deliberate divergences:

1. **Wordmark:** every "Level 13" surface becomes "HiCap Prep." This is
   the current product name (see the E4-6 backlog row); "Level 13"
   corresponds to CogAT Level 13 (grade 7), which will be one of many
   grades supported once Epic 5 ships.

2. **Grade-level field on the roster.** The design's roster has no grade
   picker; ours does. On the "Add student" flow, a grade picker (1, 3,
   4, 5, 6, 7, 8, 9, 10, 11 — no K, no 2, per Epic 5 preamble in
   `docs/PRODUCT_BACKLOG.md`) sits between name and avatar. On the
   roster row and header chip, the grade appears in the meta line
   alongside lessons and streak.

3. **Browse mode & Progress/history view** are kept — they exist in the
   built app and don't appear in the design's screen set. Both are
   reached from the Today screen's secondary link row and are styled
   with the same tokens and component patterns as the rest of the app.
   Free-practice picker (battery → tier → subtest) is treated the same
   way: kept, restyled, reached from Today.

Everything else is a literal port of the tokens and component patterns
above.
