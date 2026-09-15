# Design Brief — HiCap Prep (formerly "Level 13 Prep")

This is the brief handed to Claude Design for the visual design pass. Keep this in
sync if the brief changes — Claude Code should treat the resulting design system
(once delivered) as the source of truth for colors, type, spacing, and component
states when implementing UI, rather than inventing its own.

## ⚠️ Scope update since this brief was sent

The prompt below (sent to Claude Design) was written when this product only served
grade 7 / CogAT Level 13 and was still named "Level 13 Prep." Two things have
changed since:

1. **Multi-grade scope.** `docs/PRODUCT_BACKLOG.md` Epic 5 added a plan to expand to
   grades 3–11, and Epic 9 for grade 1 separately. The roster "add student" flow
   needs a grade/level field — the brief below describes the student picker as
   "name + avatar/color" only, but it should also capture (or infer from) each
   student's grade, since that now determines which question bank they draw from.
   This is a real UI addition, not just a data field: somewhere (roster card,
   dashboard header, program view) needs to make a student's grade visible,
   especially once a family has kids at different grades on one roster. **Still
   open** — the design pass in progress likely doesn't have this yet.
2. **Product name — now decided.** The product is renamed **"HiCap Prep."** The
   brief below still says "Level 13 Prep" throughout (kept as the historical
   record of what was actually sent) — don't build a final wordmark around that
   name. Send Claude Design this follow-up once the current pass is back, rather
   than a full re-brief:

   > Two updates: (1) the product is renamed to "HiCap Prep" — please redo the
   > wordmark/logo treatment and any on-screen branding to match, the rest of the
   > design system (palette, type, spacing, components) stays as-is; (2) the
   > student roster needs a grade-level field per kid, not just name/avatar, since
   > the product now covers multiple grades, not just grade 7.

Neither of these should block finishing the current design pass — the design system
(palette, type, spacing, component states) and most screens are unaffected by either
change. Just don't treat the current pass's branding or roster fields as final.

> Design a web app called "Level 13 Prep" — a CogAT (cognitive abilities test) practice
> platform that 7th graders use daily for ten weeks to get ready for a gifted-program
> admissions test, with a lightweight parent-control layer for running timed mock exams.
>
> AUDIENCE — design for both, deliberately:
> - The primary daily user is an 11–13 year old. They are NOT a small child — avoid
>   anything babyish, cartoonish, or "kids app" in tone. Think: capable, a little
>   competitive, wants to feel like they're making real progress, gets bored fast.
> - The secondary user is a parent who checks in periodically and runs mock tests. They
>   need this to feel calm, trustworthy, and low-anxiety — this is prep for a stressful
>   admissions test, and the design should actively counteract that stress, not amplify
>   it. Nothing that looks like a scary standardized-test interface.
> - Both users may hand the same device back and forth mid-session.
>
> THIS MUST READ AS A REAL PRODUCT, NOT A GENERATED MOCKUP:
> Before any screens, define an actual mini design system and hold every screen to it:
> - A real spacing scale (e.g. 4/8px increments) applied consistently.
> - A real type scale (display / heading / body / caption) with clear roles.
> - A small, reused component set: one button style per intent (primary / secondary /
>   ghost / destructive), one input style, one card/panel style — used identically
>   everywhere.
> - Every interactive element has defined states: default, hover, focus-visible,
>   active/pressed, disabled, and loading where relevant.
> - One consistent icon language.
> - Consistent corner-radius and elevation/shadow rules.
> - A coherent navigation shell so screens obviously belong to one app.
> - Design for realistic content: long names, zero-progress new students, a full vs.
>   empty badge row, long answer options — not just the tidiest case.
>
> AVOID: generic EdTech-SaaS look (identical rounded cards, one soft gray shadow
> everywhere, gradient washes as decoration), manipulative gamification (spinning
> coins, streak guilt-tripping, loud confetti), cold/clinical exam-portal feel,
> tracked-out ALL-CAPS eyebrow labels, em-dash-heavy microcopy, a single bolded/
> colored word in a headline. Ground the visual identity in something specific to
> this subject matter (expedition/trail-progress, field-notebook, "training gym for
> your brain" — pick one and commit).
>
> WHAT THE APP CONTAINS: student picker (shared roster, name + avatar/color, no
> photos), student dashboard (10-week completion ring, streak, mastery bars per
> battery, badges), 10-week program view (expandable weeks, 7 days each, status per
> day, Saturdays locked to parent-run mocks), quiz-taking screen (answers hidden
> until submit, MC or short numeric answer), results screen (score breakdown,
> per-question collapsed "show explanation"), parent PIN-gated area (roster progress
> table, mock launcher with visible countdown timer, settings), an effort-based
> leaderboard (completion + streaks, never accuracy/score), and nonverbal/spatial
> questions shown as simple geometric shapes.
>
> DELIVERABLES: the mini design system first; high-fidelity screens for roster
> picker, student dashboard, 10-week program (expanded + collapsed), quiz-taking,
> results (one explanation expanded), parent PIN gate, parent dashboard with an
> active mock timer, and leaderboard; plus key states (zero streak, locked day,
> correct/incorrect result, disabled/loading button, brand-new empty student).
>
> Mobile-first and responsive. Real accessibility: contrast and touch targets sized
> for an 11-year-old operating this independently.

## When the design comes back

1. Extract the design system into `docs/DESIGN_SYSTEM.md` (or ask Claude Code to do
   it) — palette hex values, type scale, spacing scale, component states — so it's a
   text artifact Claude Code can reference on every future session, not just images.
2. Point Claude Code at the exported screens/assets and have it rebuild `src/app.html`
   (or its successor once Epic 1's backend work starts) to match, rather than
   free-styling the CSS from the prompt alone.
3. Check the scope-update note above against what actually came back — the grade
   selector and the "HiCap Prep" rebrand almost certainly weren't addressed (the
   original brief didn't ask for either). Send the follow-up prompt from the note
   above rather than a full re-brief.
