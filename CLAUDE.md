# Level 13 Prep — Project Memory

Read this in full before doing anything. This file is the standing context for
every session — don't ask the user to repeat what's already written here.

## What this project is

A CogAT (cognitive abilities test) practice app for kids prepping for gifted/
advanced-learning admissions testing, built around a 10-week guided program, a
family roster, and parent-controlled timed mock tests. See:
- `docs/BUSINESS_PLAN.md` — why this exists and how it monetizes
- `docs/PRODUCT_BACKLOG.md` — **the actual work, in priority order**
- `docs/DESIGN_BRIEF.md` / `docs/DESIGN_SYSTEM.md` (once available) — visual spec

## Current state (don't rebuild what already exists)

`src/app.html` is a working single-file prototype: vanilla JS, no build step, no
dependencies. It already has: a 540-question bank (9 subtests × 3 tiers × 20
questions, randomly sampled every session), a student roster, the 10-week program
with adaptive "focus your weakest battery" logic, a quiz runner with hidden-until-
submit answers, parent PIN-gated timed mock tests, streaks/badges, and an
effort-based leaderboard. Data currently lives in a single shared, unauthenticated
storage blob (`window.storage` with a `localStorage` fallback) — **this is known
debt, not a design decision**. Epic 1 in the backlog replaces it with real
per-family accounts. Don't quietly reintroduce the shared-blob pattern while
touching auth or storage code for any other reason.

**Second known limitation:** the question bank only covers CogAT Level 13 (grade
7) — there is no `level`/`grade` dimension anywhere in `DRILLS` or the student
roster yet. Epic 5 (`docs/PRODUCT_BACKLOG.md`) plans the expansion to grades
3–11, starting with a data-model refactor (E5-0) that must land before any new
grade's content is authored. Epic 9 covers grade 1 separately — its CogAT format
is picture-based, not text-based, and doesn't fit the current architecture at
all. Don't start authoring content for another grade before E5-0 ships, or it'll
need reshaping once the `level` key exists.

## How to work through the backlog

1. Work `docs/PRODUCT_BACKLOG.md` **in priority order, one epic at a time.** Don't
   jump ahead to a later epic because it looks more interesting — later epics
   depend on earlier ones (Epic 1's backend gates almost everything after it).
2. Within an epic, do the rows in the order listed.
3. Before starting an epic, re-read its rows and the "Notes for Claude Code" column
   — that's a starting technical pointer, not a rigid spec; use judgment.
4. **Don't stop to ask permission or clarifying questions.** Make the most
   reasonable choice given the backlog description and this file, write down the
   assumption in the commit message, and keep going. If something is genuinely
   ambiguous enough that a wrong guess would be expensive to undo (e.g., a schema
   choice Epic 1 will be stuck with), pick the more reversible option rather than
   stopping.
5. **After every backlog row (or small group of closely related rows):** run the
   test suite (`npm test`). If it fails, fix it before moving on — don't accumulate
   red tests across multiple rows.
6. **Write a test for new logic you add**, especially anything touching scoring,
   random sampling, entitlements/paywall gating, or auth. `tests/smoke.test.mjs`
   is the existing pattern to extend.
7. **Commit after each completed epic** (or after each row, if an epic is large)
   with a message that states what changed and any assumptions made. Small,
   frequent commits are the review mechanism here — nobody is approving actions
   live, so the commit log has to stand in for that.
8. Update the Status column in `docs/PRODUCT_BACKLOG.md` (⬜ → 🔶 → ✅) as you go so
   the file stays a true source of truth, not a snapshot from whenever it was
   written.

## Guardrails (apply regardless of what epic you're on)

- This app handles children's data. Never log, print, or commit anything that
  looks like a real child's name, email, or identifying data — use obviously fake
  placeholder data ("Test Student") in tests and fixtures.
- Never commit secrets (API keys, Stripe keys, DB credentials). Anything like that
  goes in `.env`, which is gitignored — check `.gitignore` covers it before adding
  a new secret-bearing file.
- Keep the "not affiliated with Riverside Insights or CogAT" disclaimer intact
  anywhere it already appears; don't remove it while refactoring.
- If a task would require destructive/irreversible actions outside this repo
  (deleting a database, rotating a production credential, force-pushing over
  shared history), stop and flag it instead of proceeding — that's the one
  category worth breaking the "don't ask" rule for.

## Tech choices already made (don't relitigate without a reason)

- Backend (Epic 1): Supabase (Postgres + Auth + RLS) — chosen for speed, not
  locked in stone, but don't switch without a concrete reason written down.
- Payments (Epic 3): Stripe Checkout for one-time passes, Stripe Billing for the
  annual auto-renew tier.
- No frontend framework required unless a specific backlog row needs one — the
  current app works fine as vanilla JS and there's no reason to add build
  tooling just for its own sake.

## Testing

`npm test` runs `tests/*.test.mjs` via Node's built-in test runner + jsdom. This
started as the manual smoke-test pattern used during initial development
(simulating a full user flow: add student → practice → program lesson → mock
test → parent flows, including a deliberately hostile check that native
`alert`/`confirm`/`prompt` calls don't break anything if blocked by a sandboxed
context). Extend this file's pattern for new features rather than starting a new
ad hoc test style.
