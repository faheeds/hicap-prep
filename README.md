# HiCap Prep

CogAT prep app for gifted/advanced-learning admissions testing — 10-week guided
program, family roster, parent-controlled timed mock tests.

> **Not affiliated.** HiCap Prep is not affiliated with, endorsed by, or
> sponsored by Riverside Insights or the makers of CogAT®. CogAT is a
> registered trademark of Riverside Insights; references to CogAT here are
> strictly nominative — this is a third-party practice tool.

- **Current app:** `src/app.html` (single-file prototype, open it directly in a browser)
- **What to build next, in order:** `docs/PRODUCT_BACKLOG.md`
- **Why it exists / how it monetizes:** `docs/BUSINESS_PLAN.md`
- **Visual design spec:** `docs/DESIGN_BRIEF.md` (design system to be added once Claude Design's output is in)
- **Standing instructions for Claude Code:** `CLAUDE.md` — read this first, every session

## Quick start

```bash
npm install
npm test        # runs the full regression suite against src/app.html
```

## Backend (Epic 1)

The app starts in **local-only mode** — no accounts, all data in this
browser's `localStorage`. That's the same behaviour the prototype has always
had, and it's what the automated test suite runs against.

To point it at a real Supabase project:

1. Create a project at [supabase.com](https://supabase.com) (or run
   `npx supabase start` to boot a local stack — `supabase/config.toml` in this
   repo is preconfigured for that).
2. Copy `.env.example` to `.env` and fill in `SUPABASE_URL` /
   `SUPABASE_ANON_KEY`.
3. Apply the SQL migrations under `supabase/migrations/` (either via
   `npx supabase db push` for a hosted project or `npx supabase db reset` for
   the local one).
4. Copy `src/config.example.js` to `src/config.local.js` and paste the same
   URL + anon key into `window.__HICAP_CONFIG`. `config.local.js` is
   gitignored, so keys never end up in a commit.

With `config.local.js` present the app will boot into
Supabase-backed mode (real parent accounts, per-family data, RLS-enforced
privacy). Without it, everything still works locally — useful for demos and
CI.

## Building this with Claude Code, autonomously

This repo ships with `.devcontainer/devcontainer.json` specifically so you can run
Claude Code with full autonomy safely — the container isolates it from your host
filesystem and any real credentials, which is what makes
`--dangerously-skip-permissions` reasonable to use at all.

1. Open this folder in VS Code (or any devcontainer-compatible editor) and choose
   **"Reopen in Container"** — this builds the sandboxed environment with Claude
   Code preinstalled.
2. Inside the container:
   ```bash
   npm install
   claude --dangerously-skip-permissions
   ```
3. Give it a starting instruction, e.g.:
   > Read CLAUDE.md and docs/PRODUCT_BACKLOG.md. Implement Epic 1, row by row, in
   > order. Run `npm test` after each row and fix any failures before continuing.
   > Commit after each row with a message describing what changed and any
   > assumptions you made. Don't stop to ask me anything along the way.
4. Don't watch it live — review the commit log afterward. That's the actual
   checkpoint mechanism when nothing is asking for approval in real time.
5. Move to the next epic in a fresh session once you've reviewed the previous
   one's commits.

For a single unattended run instead of an interactive session:

```bash
claude -p "Implement Epic 1 from docs/PRODUCT_BACKLOG.md end to end, per CLAUDE.md" \
  --dangerously-skip-permissions --output-format stream-json
```

**Don't run `--dangerously-skip-permissions` outside this container** — it has no
protection against a bad or manipulated instruction taking a destructive action,
and the container is what limits the blast radius if that happens.
