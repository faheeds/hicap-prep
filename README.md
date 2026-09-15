# Level 13 Prep

CogAT prep app for gifted/advanced-learning admissions testing — 10-week guided
program, family roster, parent-controlled timed mock tests.

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
