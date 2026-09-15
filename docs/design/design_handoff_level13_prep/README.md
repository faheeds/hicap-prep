# Handoff: Level 13 Prep

## Overview

Level 13 Prep is a CogAT (Cognitive Abilities Test) practice web app. A shared family device is used daily for a ten-week, seventy-lesson program by 7th graders preparing for a gifted-program admissions test. A lightweight parent layer sits behind a PIN and runs timed Saturday mock exams.

Two users hand the same device back and forth:

- **Student (11–13).** Capable, a little competitive, bored fast. Nothing babyish or cartoonish; no manipulative gamification (no spinning coins, no streak guilt, no confetti).
- **Parent.** Checks in periodically, launches mocks. Needs calm, trustworthy, low-anxiety. Must not read like an exam portal.

Mobile-first and responsive: phone and tablet are the primary targets, shared laptop secondary. Touch targets are ≥44px throughout and all interactive elements are keyboard-navigable.

## About the Design Files

`Level 13 Prep.dc.html` in this bundle is a **design reference built in HTML**, not production code. It is an interactive prototype that shows the intended look, copy, and behavior of every screen and state.

The task is to **recreate these designs in the target codebase's existing environment** — React, Vue, SwiftUI, native, whatever the app uses — following its established component patterns, routing, state, and styling conventions. If no environment exists yet, choose the framework appropriate for the project (a React + TypeScript SPA is a reasonable default here) and implement the designs there.

Do not lift the prototype's markup, inline styles, or its single-file structure. In particular: the prototype holds all state in one component and inlines every style; a real implementation should use routes, a component library, and real design tokens.

## Fidelity

**High-fidelity.** Colors, type, spacing, states, and copy are final. Recreate the UI to match, using the codebase's own primitives. Where a value below is given as a hex or px, it is the intended value.

The one deliberate simplification: content is hardcoded sample data (three students, three questions, one week's worth of mock data). All of it comes from an API in the real product.

---

## Design Tokens

### Color

| Token | Hex | Role |
| --- | --- | --- |
| `bg` | `#fffdf9` | Page ground (warm off-white) |
| `surface` | `#fff0e3` | Warm mat: sticky action bars, keypad keys, the nonverbal question stem panel |
| `ink` | `#1d1b2e` | All body text; also the app header bar background |
| `divider` | `#e4d9cc` | Every hairline rule and default border, 1px |
| `flare` (primary) | `#f2621f` | Primary actions, progress, verbal strand |
| `lagoon` | `#0fb3a5` | Quantitative strand, timers |
| `violet` | `#6d4aff` | Nonverbal strand, badges |

Each of the three strand colors carries a 100–900 ramp. Flare and lagoon ramps:

```
flare   100 #fff1e6  200 #ffd7b8  300 #ffb075  400 #fb8640  500 #f2621f
        600 #d9470b  700 #ad3506  800 #7d2504  900 #4a1603
lagoon  100 #e2fbf7  200 #b4f2e9  300 #6fe2d3  400 #2fcbba  500 #0fb3a5
        600 #089184  700 #067168  800 #04514a  900 #02322e
violet  100 #efeaff  500 #6d4aff
neutral 100 #fbf7f2  200 #f2ebe2  300 #e2d7c9  400 #c4b6a6  500 #9d8f80
        600 #7c6f62  700 #5d5245  800 #3b3345  900 #231f37
```

Usage rules, which matter:

- **100–200 for tinted fills and hovers, 500 as the base, 700–900 for text sitting on a tint.** Body-size text never uses the 500 step on the light ground (contrast) — use 700/800.
- **A strand color is only ever used for its own strand.** Verbal = flare, quantitative = lagoon, nonverbal = violet. Badge chips cycle the three in order.
- **Correct/incorrect are never red and green.** Correct = the question's strand color filled, white glyph. Incorrect = a hollow ring in the strand color plus a `flare-800` underline on the "Correct answer:" line. Nothing in the app is alarm-colored.
- `neutral-500`/`neutral-600` carry disabled and locked states. Disabled controls also drop to 45% opacity.

### Type

Cormorant Garamond (400, 600) for headings, numerals, and buttons; Lora (400) for body. Google Fonts.

| Role | Size / weight / family | Where |
| --- | --- | --- |
| Display | 42px / 400 / Cormorant, `letter-spacing: -0.02em` | Page title, results score |
| Heading | 25px / 600 / Cormorant | Screen titles |
| Subhead | 17px / 600 / Cormorant | Week rows, card titles |
| Body | 15px / 400 / Lora, `line-height: 1.5–1.6` | Question stems, roster names |
| Small | 13px / 400 / Lora | Rows, answer options, table cells |
| Caption | 11px / 400 / Lora, `letter-spacing: 0.14em`, uppercase | Section labels, kickers, statuses |
| Figure | Cormorant, `font-variant-numeric: tabular-nums` | Every number that stands as a figure: 38/70, the ring percentage, the mock clock (52px), scores, table columns |

Headings cap at semibold — never bold. Display sizes set at 400. All figures are tabular; running prose is not.

### Spacing

A 4.6px-based scale (the design system's density is 1.15×). In implementation terms:

```
space-1  4.6px   hairline gaps, row insets
space-2  9.2px   inside rows, between buttons
space-3  13.8px  panel padding, gaps in a row
space-4  18.4px  screen gutter, header padding
space-6  27.6px  between blocks on a screen
space-8  36.8px  section breaks
```

No screen invents its own padding. If a value isn't on the scale, it's a bug.

### Radius, elevation, borders

- Radius: `2px` chips, `4px` everything (buttons, inputs, cards, panels, keypad keys), `7px` the modal, `50%` avatars and badge chips.
- Elevation is used **twice in the whole app**: the sticky bottom action bar and the running-mock panel, both `0 3px 10px rgba(45,43,43,0.16)`. Everything else is separated by a 1px divider rule.
- Default border everywhere: `1px solid divider`. Active/selected: `1px solid flare` plus `inset 0 0 0 1px flare` and a `flare-100` fill.

### Icons

Lucide, 1.5px stroke, 18px at interface size (16px inline, 14px in buttons, 26px for feature icons). One set only — no emoji, no second icon family. Icons used: `flame` (streak), `lock` (parent/locked), `check`, `chevron-down`, `chevron-left`, `arrow-right`, `clock`, `award`, `loader` (spinner).

---

## Component States

Every interactive element defines all of these. The prototype's Foundations section shows them side by side.

**Buttons.** Outlined, never solid-filled.

| Intent | Default |
| --- | --- |
| Primary | `1px solid flare`, text `flare`, transparent fill |
| Secondary | `1px solid divider`, text ink |
| Ghost | no border, text `flare`, reduced inline padding |
| Destructive | secondary shape, `flare-800` border and text (used for "End test") |

States, applied identically to all intents:

- Hover: fill with the accent at 12% alpha (secondary: ink at 7%).
- Active/pressed: accent at 22% (secondary: ink at 14%).
- Focus-visible: `outline: 2px solid flare; outline-offset: 2px`. Never the browser default.
- Disabled: `opacity: 0.45`, `cursor: not-allowed`, no hover.
- Loading: disabled, `opacity: 0.7`, label changes to the gerund ("Scoring"), 14px spinner rotating 360° over 0.9s linear, infinite.

Minimum button height 44px; primary CTAs 48px.

**Input.** One style. Full width, min-height 36px (44–48px where a student types), transparent fill, `1px solid divider`, radius 4px, 14px text, caret in `flare`. Hover darkens the border; focus-visible switches the border to `flare` with `outline-offset: 0`. Label above at 12px, 70% ink.

**Card / panel.** Transparent fill, `1px solid divider`, radius 4px, `space-3` padding, column flex with `space-2` gaps. Tinted variant swaps in `flare-100` fill and `flare-300` border (used for the streak panel).

**Toggle switch.** 52×30px pill, 22px knob. Off: transparent fill, `neutral-400` border, `neutral-500` knob. On: `flare` at 14% fill, `flare` border, `flare` knob.

**Answer option.** See the quiz screen below.

---

## Navigation Shell

Persistent across every screen so the app reads as one product.

**Header bar** (always visible, 1px `flare-800` bottom border, background `ink`):
- Left: wordmark "Level 13", Cormorant 600 16px, in `flare-300`.
- Right: the current student's chip — 26px circular avatar filled `flare-400` with `flare-900` initials, then the student's first name at 13px in `neutral-100`. Tapping it returns to the roster (switch student). Hidden when no student is selected.
- Far right: a 44×44 icon button with the `lock` glyph, `flare-700` border, `flare-300` glyph. Opens the parent area — the PIN gate if not yet authenticated this session, the parent dashboard if it is.

**Tab row** (below the header, only on the three student screens): Today · The route · Board. Each tab is a 48px-min flex-1 button; the active tab gets a `flare-100` fill and a 3px `flare-500` bottom border with `flare-800` label; inactive labels are `neutral-700`. Cormorant 600 14px.

**Back pattern.** Screens outside the tab set (quiz, results, PIN) use a left-aligned ghost "Back" button with a `chevron-left`, 44px min height, in the row directly under the header. Quiz back goes to the previous question, or to Today from question 1. Parent area exits via a "Lock" ghost button in its own header row, which clears authentication and returns to the roster.

---

## Screens

The prototype frame is 520px max-width and centered; on a phone the app fills the viewport. All screens are a single column with `space-4` gutters and `space-6` between blocks.

### 1. Roster picker — "Who's practicing today?"

Purpose: pick which kid is practicing, on a device shared between siblings.

Layout: `space-6`/`space-4` padding. A `flare-700` caption ("Day 41 · Week 6"), then a 28px/400 Cormorant heading "Who's practicing today?". Below, one row per student, each `border-top: 1px solid divider`, min-height 64px, `space-3` gap:

- 38px circular avatar, `flare-200` fill, `1px solid flare-500`, initials in Cormorant 15px `flare-900`.
- Name at 15px, truncated with ellipsis (single line).
- Second line, 12px `neutral-700`, tabular: `"38/70 lessons · 12-day streak"`, or `"24/70 lessons · streak broken"`, or `"New — nothing logged yet"`.
- Trailing 18px `arrow-right` in `flare`.

Closing note, 12px `neutral-700`: "Hand the device to whoever is practicing. Parents get in through the lock at the top right."

Sample roster (used throughout): **Maya Okonkwo-Lindqvist** (38 lessons, streak 12, best 12, 6 badges, mastery 78/64/71, last practiced Today), **Theo Park** (24, streak 0, best 9, 3 badges, 61/70/55, 4 days), **Ines Alvarez** (0, 0, 0, 0 badges, not measured, "—"). Maya's name is deliberately long — it must truncate cleanly in the header chip, roster row, leaderboard, and parent table.

### 2. Student dashboard ("Today")

Purpose: show progress at a glance and get the student into today's lesson in one tap.

Blocks, top to bottom:

1. **Identity + ring.** Left column: `flare-700` caption "Week 6 of 10"; the student's full name at 25px/600 Cormorant with `overflow-wrap: break-word` (Maya's name wraps to two lines — this is expected); "38 of 70 lessons finished" at 13px `neutral-700`. Right: a 96px SVG completion ring — `r=42`, track `flare-100` fill with a 7px `flare-200` stroke, progress arc 7px `flare-500`, round cap, `stroke-dasharray` = `(lessons/70 × 263.9) 263.9`, rotated −90° about the center. Centered inside: the percentage in Cormorant 24px tabular, and the caption "ROUTE" at 10px.
2. **Streak panel.** `flare-100` fill, `flare-300` border, radius 4. Row: `flame` icon (stroke `flare` when the streak is live, `neutral-500` when it is 0), then "12 days in a row" in Cormorant 20px tabular, then right-aligned "best 12" at 12px. Below, a 12px note. Copy by state:
   - Live streak: "Two rest days a week are fine; the streak only counts practice days."
   - Broken, with a best: "The run ended 4 days ago. One lesson today starts a new one — the best run of 9 days stays on the record."
   - Brand new: "A streak starts with the first finished lesson."
3. **Reasoning strands.** Caption "REASONING STRANDS", then three rows. Each: label ("Verbal reasoning") at 13px, right-aligned value ("78%", or "not measured" at zero), and an 8px track — `flare-100` fill, `1px flare-200` outline, radius 4 — with the fill in that strand's color at the mastery percentage.
4. **Badges.** Caption row with "6 of 10" right-aligned. Ten slots in a 5-column grid, `space-2` gaps. Earned: 40px circle filled with the strand color for its index (cycling flare → lagoon → violet), white 16px `award` glyph, label below at 10px `neutral-800`. Unearned: same circle with a `1px dashed neutral-400` border and `neutral-400` glyph and label. Badge names in order: 3 Days, 7-Day Streak, Verbal Ace, Week 1, Mock Milestone, Week 5, Quant Ace, Nonverbal Ace, Half Route, Full Route.
   - **Empty state** (zero badges): instead of the grid, a `1px dashed neutral-400` panel — "Nothing earned yet" (Cormorant 17px) and "The first badge comes after three days in a row. Ten to collect over the route." (12px).
5. **Sticky action bar.** Pinned to the bottom of the viewport, `surface` background, 1px top divider, `shadow-md`. A 12px row — left: "Week 6 · Quantitative relations" (the current week's title); right: "~12 min". Then a full-width 48px primary button: **"Continue where you left off"**, or **"Begin the route"** for a student with zero lessons.

Week titles, 1–10: Getting your bearings · Analogies and opposites · Number series · Figure matrices · Sentence completion · Quantitative relations · Paper folding · Mixed sets · Pace and stamina · Final rehearsal.

### 3. The 10-week program view ("The route")

Purpose: see the whole ten-week path and open a specific day.

Header row: caption "THE ROUTE", heading "Ten weeks, seventy days", and a right-aligned ghost button toggling **Expand all / Collapse all** (the label reads "Collapse all" once more than three weeks are open).

**Collapsed week row** (the default for all but the current week): `border-top: 1px solid divider`, min-height 64px, `space-3` gap.
- A 30px circle with the zero-padded week number in Cormorant 13px tabular. Completed weeks (7/7) fill `flare-200` with a `flare-500` border and `flare-900` numeral; others are `neutral-400` border, `neutral-700` numeral.
- Week title at Cormorant 17px, and below it a 12px `neutral-700` summary: "complete · 7 of 7", or "3 of 7 · this week", or "0 of 7".
- A `chevron-down` in `neutral-600`, rotated 180° when expanded.

**Expanded week** reveals seven day rows, indented 42px from the left so they hang under the title. Each row: `border-top: 1px divider`, min-height 48px — a 34px uppercase 12px day abbreviation (Mon…Sun) in `neutral-600`, the lesson title (ellipsis-truncated), a status caption, and a status icon.

Day statuses:
- **Done** — full-contrast text, caption "done", 16px `check` in `flare-700`.
- **Start** (the next unfinished day of the current week only) — caption "start" in `flare-800`, 16px `arrow-right` in `flare`. Tapping it opens the quiz.
- **Locked (parent-run)** — every Saturday that isn't yet done. Caption "parent starts", 16px `lock` in `neutral-600`, `cursor: not-allowed`, not clickable. Title "Timed mock test".
- **Upcoming** — `neutral-600` text at `opacity: 0.6`, no caption, disabled.

Sundays are "Mixed review set"; weekday titles are generated from the week's theme ("Getting set 1" … ).

Closing note: "Saturdays are timed mock tests. A parent unlocks and starts them from the parent area, so nobody sits a mock by accident."

### 4. Quiz

Purpose: one question at a time, answers hidden until the whole set is submitted.

Chrome: a back row (ghost "Back" + `chevron-left`) with a right-aligned "Question 2 of 3" at 12px tabular, then a 5px `flare-100` progress track with a `flare-500` fill at `(index+1)/total`.

Body: a `flare-700` caption naming the strand ("Verbal reasoning"), then the question stem at 17px/1.5. Three question kinds:

**Multiple choice.** Four full-width option buttons stacked with `space-2`, each `space-3` padding, min-height 56px, radius 4, `1px solid divider`, left-aligned. A 26px circular letter badge (A–D) in Cormorant 13px with a `neutral-400` border and `neutral-700` letter, then the option text at 14px/1.5. Selected: `flare-100` fill, `flare` border, `inset 0 0 0 1px flare`, `flare-800` text, and the letter badge switches to a `flare` border with `flare-800` letter. Options wrap to as many lines as they need — one sample option is deliberately long ("a chisel, which is the tool used to remove material from the block until the finished surface appears") and must not truncate or clip.

**Numeric.** A single 220px-max field, min-height 48px, 17px tabular text, placeholder "—", `inputmode="numeric"`, labelled "Your answer". Free text entry; whitespace-trimmed string comparison on submit.

**Nonverbal / spatial.** The shapes are the content, so the presentation stays uncluttered: a centered `surface` panel with a 1px divider border holds the four-cell stem — three 56px SVG frames showing the sequence and a fourth drawn with a `neutral-500` dashed border as the empty cell. Stroke 1.5px, `ink`, no fill. Below, four option tiles in a 4-column grid, each `aspect-ratio: 1`, holding a 48px SVG. Selection styling matches the choice options (tinted fill, accent border, `currentColor` stroke shifting to `flare-800`).

Note under every question, 12px `neutral-700`: "Answers stay hidden until you submit the whole set. You can go back and change any of them."

**Sticky bottom bar.** Left: "1 of 3 answered" at 12px. Right: a 48px primary **Next** (min-width 120px), disabled until the current question has an answer. On the last question it becomes **Submit answers** (min-width 150px), disabled until all questions are answered; pressing it enters the loading state — spinner + label "Scoring" — for 1.1s, then navigates to results.

Sample questions:
1. *Verbal reasoning* — "sculptor : marble :: composer : ?" Options A–D as above; correct C, "sound arranged over time". Explanation: "The first pair links a maker to the material worked. A sculptor shapes marble; a composer shapes sound in time. The orchestra performs the work and the chisel is a tool, so neither is the material itself."
2. *Quantitative reasoning* — "A sequence begins 3, 7, 15, 31. What number comes next?" Answer "63". Explanation: "Each term doubles and adds one: 3 x 2 + 1 = 7, 7 x 2 + 1 = 15, 15 x 2 + 1 = 31. So the next term is 31 x 2 + 1 = 63. Checking the gaps also works: they run 4, 8, 16, then 32."
3. *Nonverbal reasoning* — "The arrow turns a quarter-turn counter-clockwise each step. Which figure belongs in the empty square?" Stem arrows point down, left, up; correct answer is the arrow pointing right inside a square (option A). Distractors: arrow down in a square, arrow right in a circle, arrow right in a triangle. Explanation: "Only the arrow rotates: down, left, up, then right. The frame stays a square throughout, which rules out the circle and the triangle no matter which way their arrows point."

### 5. Results

Purpose: a calm score, a strand breakdown, and optional explanations.

1. **Score block.** Caption "Week 6 · 3-question set"; heading "Two of three, one to look at" (or "Clean sweep" at 100%); the score as Cormorant 42px tabular "2/3" with "correct" beside it at 13px; then the note: "Nothing here counts toward the admissions test. The point is to find the one you want to look at again."
2. **By strand.** Caption, then one divider-separated row per strand: label, right-aligned "1/1" tabular, and a 12px dot with a 2px border in the strand color — filled when correct, hollow when not.
3. **Question by question.** One divider-separated block per question, `space-2` gaps:
   - A 24px circular mark with a 2px strand-colored border: correct is filled with a white "✓", incorrect is hollow with a `neutral-700` "·".
   - The stem at 13px, then "Your answer: C · sound arranged over time" at 12px `neutral-700` (numeric answers print the raw value, "—" if blank).
   - The verdict line: "Correct" in `neutral-700` when right; when wrong, "Correct answer: 63" in `flare-800` with a 1px `flare` bottom border, self-aligned so the underline hugs the text.
   - A ghost **Show explanation / Hide explanation** toggle with a rotating `chevron-down`, **collapsed by default** — never auto-expanded and never forced. Expanded, the explanation sets at 13px/1.65, justified, `neutral-800`, with a `1px solid flare` left border and `space-3` left padding.
4. **Sticky bottom bar:** secondary "The route" and primary "Done for today", equal width, 48px.

### 6. Effort board ("Board")

Purpose: a leaderboard that can only ever reward showing up.

Caption "THIS WEEK", heading "Effort board", then divider-separated rows, min-height 56px, sorted by **lessons completed, then streak length** — never by accuracy or score. Each row: rank in Cormorant 16px tabular (22px column), a 32px avatar (rank 1 gets a `flare-300` fill with a `flare-600` border and `flare-900` initials; everyone else `neutral-200`/`neutral-400`/`neutral-800`), the name (ellipsis-truncated), "24 lessons" at 12px tabular, and a `flame` + streak count. The signed-in student's row is tinted `flare-100`.

Sample board: Maya Okonkwo-Lindqvist 38/12, Dev Ramanathan 31/6, Sofia Brandt 29/4, Theo Park 24/0, Ines Alvarez 0/0.

Closing note, justified 12px: "Ranked by lessons finished and days in a row. Test scores are never shown here and never affect the order, so the board can only ever reward showing up."

### 7. Parent PIN gate

Centered column. A 26px `lock` icon in `flare`, heading "Parent area", and "Four digits. Progress, mock tests and settings live behind here." at 13px in a 34ch measure.

Four 14px dots with `space-3` gaps — filled `flare` with a `flare` border once entered, otherwise transparent with a `neutral-400` border. Below them an error line at 12px `flare-800` that holds layout space with `visibility: hidden` when empty, so the keypad never shifts: "That PIN did not match. Try again."

A 3-column keypad (260px max) of 56px keys: 1–9, an empty cell, 0, and "Delete" (12px label; digits are Cormorant 20px tabular). Keys are `surface`-filled with a 1px divider border and radius 4. Entering a 4th digit validates immediately: on success, authenticate and go to the parent dashboard; on failure, clear the field and show the error. Prototype PIN is `2468` — replace with real auth.

Footer: ghost "Back to students".

### 8. Parent dashboard

Header row: caption "Saturday, week 6", heading "Parent area", right-aligned ghost "Lock" (clears auth, returns to the roster).

**Mock-test launcher — idle.** A divider-bordered panel: "Week 6 mock test" (Cormorant 17px) and "36 questions · 30 minutes · all three strands" at 12px tabular. Then "Who is sitting it?" and a segmented control of student first names (44px options, 1px divider separators; the selected option takes an `inset 0 0 0 1px flare` ring and `flare-800` text). Then a 48px primary **"Start the timer"**, disabled when the "Saturday mock tests" setting is off. Note: "Hand the device over once the timer starts. It keeps running if the screen sleeps, and you can pause it for a break."

**Mock-test launcher — running.** The panel switches to a `flare` border, `surface` fill, and `shadow-md`:
- Row: 18px `clock` in `flare`, caption "MOCK TEST IN PROGRESS", and a right-aligned "LIVE" in `flare-800` pulsing between 1 and 0.45 opacity over 2.4s ease-in-out, infinite.
- The clock: Cormorant **52px** tabular, `m:ss` (e.g. "18:49"), counting down once per second from 1800s.
- "Maya Okonkwo-Lindqvist · week 6 mock · 36 questions" at 13px.
- A 2px `neutral-300` track with a `flare` fill at `remaining/1800`.
- Two 44px secondary buttons: "Pause" (stops the tick, keeps the remaining time) and "End test" (the destructive variant: `flare-800` border and text; resets to 1800s and returns to idle).

The countdown must be wall-clock based in production (persist a start timestamp) so it survives a sleeping screen or a reload — the prototype's `setInterval` is a stand-in.

**Progress table.** A four-column table — Student / Lessons / Streak / Last — with an 11px uppercase `neutral-600` header row, 1px divider row rules, and a 4%-ink hover tint. Numbers right-aligned and tabular ("38/70", "12 d", "—" when there's no streak). The Student cell caps at 150px and truncates.

**Settings.** Divider-separated rows, each a label at 13px with an 11px `neutral-700` note and a trailing toggle:
- "Daily practice reminder" — "5:30pm on school days" — on.
- "Saturday mock tests" — "Turning this off hides Saturdays from the route" — on. Turning it off disables the mock launcher's start button.
- "Sound on answers" — "Off by default" — off.

---

## Interactions & Behavior

- **Navigation.** Roster → dashboard (selects the student) → tabs move between dashboard / program / board. The dashboard CTA and a "start" day row both open the quiz. Quiz → results → back to dashboard or program. The header lock opens the PIN gate, or the parent dashboard when already authenticated for the session; "Lock" drops authentication.
- **Answer visibility.** Nothing reveals correctness during the quiz. No per-answer feedback, no sounds, no animation on selection beyond the selected styling.
- **Submit.** 1.1s loading state, then results. In production this is the scoring request; keep the disabled + gerund-label + spinner pattern.
- **Explanations.** Collapsed by default, independently toggleable, and never auto-opened.
- **Locked days** are inert — no tap target, no error message, just the lock glyph and "parent starts".
- **Transitions.** Deliberately minimal: the chevron rotation (180°), the "LIVE" pulse, and the submit spinner are the only motion in the app. No confetti, no coin animations, no streak-loss warnings.
- **Responsive.** Single column throughout; the app fills the viewport up to a comfortable measure (the prototype caps at 520px and centers). Sticky bars pin to the bottom of the viewport on phones. Every row is a full-width tap target of at least 44px (56–64px for primary list rows). Long content — names, option text, lesson titles — either truncates with ellipsis (single-line contexts) or wraps (headings, option text). Never both.
- **Accessibility.** Keyboard reachable in reading order; focus-visible is a 2px `flare` outline at 2px offset on every interactive element. Body text is at least 4.5:1 on its ground, which is why accent text uses the 700/800 ramp steps. Icon-only buttons carry accessible names ("Parent area", "Switch student"). The PIN error should be announced (`role="status"`), and the mock countdown should be a polite live region that updates by the minute, not the second.

## State Management

Session/UI state in the prototype, all of which maps onto real routes plus a small amount of client state:

| State | Shape | Notes |
| --- | --- | --- |
| `route` | roster / dashboard / program / quiz / results / board / pin / parent | Becomes real routes |
| `studentId` | string or null | Null = no student picked; the header chip hides |
| `openWeeks` | number[] | Which weeks are expanded; defaults to the current week |
| `qIndex` | number | Current question |
| `answers` | `{ [questionId]: number \| string }` | Choice index or typed numeric string |
| `scoring` | boolean | Submit loading state |
| `openExpl` | string[] | Which explanations are expanded |
| `pin`, `pinError` | string | Keypad buffer and message |
| `parentAuthed` | boolean | Session-scoped; cleared by "Lock" |
| `mockSecs`, `mockRunning`, `mockWho` | number / boolean / string | Timer state; persist a start timestamp server-side |
| `settings` | `{ reminder, mocks, sound }` | Per-family |

Data the real app needs to fetch: the student roster (name, initials, lessons completed, current and longest streak, badge count, per-strand mastery, last practiced), the 70-lesson program with per-day status, a question set per lesson, scored results with explanations, the effort-board ranking, and family settings. Derived in the UI, not stored: percentage complete, current week (`floor(lessons/7)+1`), per-week completion counts, day status, and the board ordering.

## Assets

None. Every graphic is inline SVG: the completion ring, the mastery bars, the progress tracks, and the nonverbal question's geometric figures. Icons are Lucide — install the icon package for the target framework rather than copying paths. Fonts are Cormorant Garamond and Lora from Google Fonts; self-host them in production.

No photography and no student photos anywhere — avatars are initials on a colored disc, by design.

## Files

- `Level 13 Prep.dc.html` — the complete interactive prototype. It opens directly in a browser. Its top section is the design-system reference (palette, type scale, spacing, component states); below it, a row of "Jump to" buttons sets up each state worth reviewing: roster, new student with no history, broken streak, locked parent day, quiz, results with one wrong answer, PIN gate, mock timer running, effort board. Everything those jumps show is also reachable by ordinary navigation.
- The prototype loads the Classical design system's stylesheet from `_ds/classical-.../styles.css` for its base type and component classes, then overrides the palette to the vibrant tokens listed above. Only the token values in this README are authoritative.
