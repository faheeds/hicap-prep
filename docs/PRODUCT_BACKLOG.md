# Product Backlog — Level 13 Prep (CogAT App)

This is written to be fed directly to Claude Code, one epic (or even one row) at a time. Epic 0 documents what already exists in `cogat_prep_app.html` so Claude Code doesn't rebuild it. Epics 1+ are new work, **ordered by priority** — build top to bottom unless a dependency forces a reorder (dependencies are called out per item).

### Legend
- **Status:** ✅ Shipped &nbsp;|&nbsp; ⬜ Not started &nbsp;|&nbsp; 🔶 In progress
- **Priority:** **P0** = launch blocker, can't charge money without it &nbsp;|&nbsp; **P1** = needed for a good paid launch &nbsp;|&nbsp; **P2** = needed to scale past the first pilot &nbsp;|&nbsp; **P3** = later / opportunistic
- **Effort:** S (hours) · M (1–3 days) · L (1–2 weeks) · XL (multi-week)

### Recommended build order (the short version)
1. **E1 — Backend & real accounts** (everything else depends on this)
2. **E2 — Compliance** (must ship alongside E1, not after — it's a launch blocker, not a checkbox)
3. **E3 — Payments & paywall**
4. **E4 — Paid-launch product gaps** (onboarding, security hardening, testing, naming decision)
5. **E5 — Multi-grade content expansion, Grades 3–11** (this is what makes the Family Pass promise — "one price, every kid in the house" — actually true; see `docs/BUSINESS_PLAN.md` §3/§5)
6. **E6 — Growth & analytics**
7. **E7 — B2B / district & tutor licensing**
8. **E8 — Platform & distribution (PWA, app stores)**
9. **E9 — Grade 1 / CogAT Level 8** (separate initiative, picture-based format — deliberately last, see epic notes)

---

## Epic 0 — Already shipped (current prototype)

Reference only — everything here exists in `cogat_prep_app.html` today. Don't rebuild it; extend it.

| ID | Status | Feature |
|---|---|---|
| E0-1 | ✅ | 540-question bank, 9 subtests × 3 tiers, 20 questions/pool |
| E0-2 | ✅ | Random sampling engine (practice=10/subtest, program day=10/subtest, speed round=3/subtest, mock=5/subtest) |
| E0-3 | ✅ | Student roster (add/select/switch, avatar + color assignment) |
| E0-4 | ✅ | 10-week guided program with weekly plan generator |
| E0-5 | ✅ | Adaptive "focus your weakest battery" Thursday logic |
| E0-6 | ✅ | Sunday auto-review of that week's missed questions |
| E0-7 | ✅ | Free-practice picker (battery → tier → subtest) |
| E0-8 | ✅ | Browse mode (answers/explanations always visible) |
| E0-9 | ✅ | Test runner: answers hidden until submit, per-question explanation toggle on results |
| E0-10 | ✅ | Parent PIN gate (client-side, 4-digit, default 1234) |
| E0-11 | ✅ | Parent-configured, timed mock tests with auto-submit at zero |
| E0-12 | ✅ | Streaks (current/longest), badges (10 rules), effort-based leaderboard |
| E0-13 | ✅ | Parent dashboard: roster overview, mock launcher, roster management, PIN change |
| E0-14 | ✅ | Shared persistent storage (`window.storage`) with `localStorage` fallback |
| E0-15 | ✅ | In-app modal system (no native `alert`/`confirm`/`prompt` dependency) |
| E0-16 | ✅ | Responsive single-file layout, no build step, no external dependencies |

**Known debt already flagged (carry into Epic 1/4):** all data lives in one shared, unauthenticated bucket; the parent PIN is compared in client-side JS (viewable/bypassable via devtools); there's no real user identity at all — "students" are just names in a shared blob. **Also scope debt:** the question bank and every sampling function only know about one CogAT level (Level 13 / grade 7) — there's no `grade`/`level` dimension anywhere in the data model yet. See Epic 5.

---

## Epic 1 — Backend & real accounts (P0, blocks everything monetized)

| ID | Pri | Status | Feature | Description / Acceptance Criteria | Notes for Claude Code |
|---|---|---|---|---|---|
| E1-1 | P0 | ⬜ | Choose & stand up backend | Pick a backend (Supabase is the fastest path: Postgres + Auth + row-level security in one). Project created, connected. | `npx supabase init`; keep it simple, one Postgres project |
| E1-2 | P0 | ⬜ | Parent account auth | Email/password or magic-link signup & login for the **parent** (not the kid). Session persists across visits. | Supabase Auth; store session token client-side, gate parent-mode routes on it |
| E1-3 | P0 | ⬜ | Data model migration | Design real tables: `families`, `students` (include a `cogat_level` or `grade` column even though only Level 13 content exists yet — see Epic 5), `attempts` (history rows), `badges_earned`. One family = one parent account = private data. | Replace the single shared JSON blob with normalized tables; get the `grade` column in now so Epic 5 isn't a second migration |
| E1-4 | P0 | ⬜ | Row-level security | A family can only ever read/write its own rows — enforced at the database level, not just in app logic. | Supabase RLS policies keyed on `auth.uid()` |
| E1-5 | P0 | ⬜ | Replace `Store` layer | Swap every `window.storage`/`localStorage` call for real API calls (Supabase client SDK) behind the same `loadApp()`/`saveApp()` interface so the rest of the app barely changes. | This is the highest-leverage refactor — isolate it behind one module |
| E1-6 | P0 | ⬜ | Server-verified parent PIN | Move PIN check to a server function; never send/compare the PIN in client JS. Add basic rate limiting (e.g., lock out after 5 bad attempts for 5 minutes). | Supabase Edge Function or equivalent; store a hashed PIN, not plaintext |
| E1-7 | P0 | ⬜ | Account & data deletion | A parent can permanently delete their family's account and all child data from one settings screen. | Required for COPPA/privacy compliance, not optional |
| E1-8 | P1 | ⬜ | Data export | A parent can export their family's full history as JSON or CSV. | Supports both compliance and "I want my kid's data" trust-building |

---

## Epic 2 — Compliance & trust (P0, ship alongside Epic 1)

| ID | Pri | Status | Feature | Description / Acceptance Criteria | Notes |
|---|---|---|---|---|---|
| E2-1 | P0 | ⬜ | Privacy Policy page | Real, specific privacy policy — what's collected (child's first name, avatar, quiz history), why, who can see it, how to delete it. | Don't use a generic template unedited — it needs to accurately describe what this app actually stores |
| E2-2 | P0 | ⬜ | COPPA-style parental consent flow | Before any child data is entered, the *parent* (verified via their own account) explicitly consents. Add a checkbox + timestamp logged. | This is the actual compliance mechanism, not just a policy page |
| E2-3 | P0 | ⬜ | Terms of Service page | Standard ToS, written to match this product (seasonal pass terms, refund policy, no guarantee of test outcomes). | |
| E2-4 | P0 | ⬜ | Trademark-safe disclaimers | "Not affiliated with or endorsed by Riverside Insights or CogAT" — footer of every page, plus landing page and app-store listing copy. | Avoid using the CogAT logo or exact trade dress anywhere |
| E2-5 | P1 | ⬜ | Data retention policy + auto-cleanup | Define and implement a retention window (e.g., auto-delete inactive family data after 18 months, with a warning email first). | |
| E2-6 | P1 | ⬜ | Cookie/analytics consent banner | Only needed once E6-3 (analytics) ships — gate it on that. | Depends on E6-3 |

---

## Epic 3 — Payments & paywall (P0/P1)

| ID | Pri | Status | Feature | Description / Acceptance Criteria | Notes |
|---|---|---|---|---|---|
| E3-1 | P0 | ⬜ | Stripe integration | Stripe account connected, test mode working end to end. | Stripe Checkout, not a custom card form — less PCI scope |
| E3-2 | P0 | ⬜ | Individual Pass purchase | One-time $49 Checkout session → webhook → mark family entitled for 1 student, current season. | Stripe webhook must update the `families` table's entitlement fields |
| E3-3 | P0 | ⬜ | Family Pass purchase | One-time $79 Checkout session → unlimited students on the roster. | |
| E3-4 | P0 | ⬜ | Entitlement gating in-app | Free tier: browse mode + 1 practice subtest/day, no mocks, no full program. Paid: everything unlocked. Gate checked server-side, not just hidden in the UI. | Add an `entitlement` check to program/mock-launch code paths |
| E3-5 | P1 | ⬜ | Annual auto-renew Family Pass | $129/year Stripe Subscription option, cancel-anytime. | Depends on E3-1 |
| E3-6 | P1 | ⬜ | Receipt & confirmation email | Automated email on purchase (Stripe can trigger this, or a simple transactional email service). | |
| E3-7 | P1 | ⬜ | Promo/discount codes | Support a code at checkout (for pilot families, referrals). | Stripe Coupons |
| E3-8 | P2 | ⬜ | Refund/cancellation self-service | Parent can request a refund or cancel a subscription from account settings without emailing support. | |

---

## Epic 4 — Paid-launch product gaps (P1)

| ID | Pri | Status | Feature | Description / Acceptance Criteria | Notes |
|---|---|---|---|---|---|
| E4-1 | P1 | ⬜ | Landing page / onboarding | A real first-visit page explaining what this is, for someone who's never seen it — currently the app assumes the visitor already knows. | Separate from the app shell; this is the marketing entry point |
| E4-2 | P1 | ⬜ | Automated regression tests | Formalize the manual `node`/`jsdom` smoke tests already used during development into a real test suite (scoring logic, random sampling, timer auto-submit, modal flows). | Playwright or Jest + jsdom; run on every change |
| E4-3 | P1 | ⬜ | Accessibility pass | Keyboard navigation through the quiz runner, ARIA labels on custom controls, color-contrast check on the palette. | |
| E4-4 | P2 | ⬜ | Email reminders | Optional weekly digest to parents ("3 lessons left this week") and streak-risk nudges. | Needs consent (opt-in), ties to E2-2 |
| E4-5 | P2 | ⬜ | Printable PDF progress report | One-click export of a student's program progress + mastery bars, useful for parents sharing with a tutor. | |
| E4-6 | P1 | ⬜ | Decide product name/brand for multi-grade scope | "Level 13 Prep" (app title, repo name, file names) anchors the whole brand to grade 7 specifically. Once Epic 5 ships other grades, that name undersells or confuses the product. Decide: keep it as a sub-brand ("Level 13 Prep" becomes the grade-7 track name inside a bigger product), or rename the whole thing. | This is a founder decision, not something to silently resolve in code — resolve it before E4-1 (landing page) ships, since that page has to explain the product to every grade's parent, not just grade 7's |

---

## Epic 5 — Multi-grade content expansion: Grades 3–11 (P1/P2)

BSD (and most CogAT districts) accept parent-initiated testing applications for grades 1 and 3–11; grades K and 2 are auto-screened by the district, so there's no parent-facing product need there. CogAT's format is consistent across grades 3–11 (same 9 subtests, same Verbal/Quant/Nonverbal structure — this app's existing architecture already fits it) but changes structurally for grade 1 (Level 8: picture-based, no reading) — that's why grade 1 is split out into its own epic (E9) instead of folded in here.

| Grade | CogAT Level | Format |
|---|---|---|
| 3 | 9 | Text-based — same structure as Level 13 |
| 4 | 10 | Text-based |
| 5 | 11 | Text-based |
| 6 | 12 | Text-based |
| 7 | 13 | ✅ Already built |
| 8 | 14 | Text-based |
| 9 | 15 | Text-based |
| 10 | 16 | Text-based |
| 11 | 17 | Text-based |

| ID | Pri | Status | Feature | Description / Acceptance Criteria | Notes for Claude Code |
|---|---|---|---|---|---|
| E5-0 | P1 | ⬜ | **Data model refactor: add a level dimension** | `DRILLS` is currently keyed `battery → tier → subtest`. Add `level` as the outermost key: `DRILLS[cogatLevel][battery][tier][subtest]`. Thread a `level` parameter through every function that reads it: `sampleQuestions`, `collectQuestions`, `collectMixedSpeed`, `collectMock`, `weekPlan`. Add a grade/level field to the student roster (parent sets it once when adding a student; map grade → CogAT level via the table above). | **Prerequisite for every other row in this epic** — do this first, before authoring any new content. Existing Level 13 content becomes `DRILLS[13][...]` with no data loss. This is a contained refactor (~1 session), not a rewrite — the sampling/program/mock logic is already written generically per-battery/tier, it just needs one more key |
| E5-1 | P1 | ⬜ | Reusable content-authoring pipeline | Formalize the Python/JSON merge process already used to build the Level 13 bank into a repeatable script: define a question "template" per subtest type (e.g. "word-relationship analogy," "double-then-subtract-one number series"), recalibrate vocabulary/number ranges per grade level, generate the pool. | This already exists informally from Level 13's development — the highest-leverage row after E5-0, since every level bank after this reuses it |
| E5-2 | P1 | ⬜ | Nonverbal (FC/FM/PF) recalibration pass | Nonverbal/spatial-reasoning content transfers across grades with light recalibration (more shapes/steps at harder levels) rather than full re-authoring — unlike Verbal and Quant, which need real grade-level tuning. Confirm this holds and build the lighter-weight recalibration path first. | Cheapest win in the epic — do this before the heavier Verbal/Quant authoring work per level |
| E5-3 | P1 | ⬜ | CogAT Level 12 bank (grade 6) | 9 subtests × 3 tiers × 20 questions, via the E5-1 pipeline. | Build first — closest in difficulty to the already-tuned Level 13 content, and the most likely immediate sibling-upsell (a grade-7 family often has a grade-6 kid at home) |
| E5-4 | P1 | ⬜ | CogAT Level 14 bank (grade 8) | Same. | Same rationale as E5-3, other direction |
| E5-5 | P2 | ⬜ | CogAT Level 11 bank (grade 5) | Same. | |
| E5-6 | P2 | ⬜ | CogAT Level 15 bank (grade 9) | Same. | |
| E5-7 | P2 | ⬜ | CogAT Level 9 bank (grade 3) | Same. | Furthest from Level 13 in vocabulary/complexity — expect more authoring time per pool than E5-3/E5-4 |
| E5-8 | P2 | ⬜ | CogAT Level 10 bank (grade 4) | Same. | |
| E5-9 | P2 | ⬜ | CogAT Level 16 bank (grade 10) | Same. | |
| E5-10 | P2 | ⬜ | CogAT Level 17 bank (grade 11) | Same. | |
| E5-11 | P1 | ⬜ | Level selector in the UI | Browse mode and the free-practice picker need a grade/level selector alongside battery/tier. The 10-week program already reads a student's assigned level implicitly once E5-0 lands — just needs the roster "add student" form to capture it. | Depends on E5-0 |
| E5-12 | P2 | ⬜ | Grow existing pools further (any level) | Use real usage data — are families exhausting a level's pools within a season? — to decide if 20/pool needs to grow for that level. | Data-driven, per level — don't do this speculatively across the board |

---

## Epic 6 — Growth & analytics (P1/P2)

| ID | Pri | Status | Feature | Description / Acceptance Criteria | Notes |
|---|---|---|---|---|---|
| E6-1 | P1 | ⬜ | Founder funnel dashboard | Track signup → free-usage → paid conversion, and program/mock completion rates. This is the data the business plan's financial model depends on. | Even a simple admin-only page reading straight from the DB is enough at this stage |
| E6-2 | P2 | ⬜ | Referral program | Give-a-discount/get-a-discount code shared between families. | Depends on E3-7 |
| E6-3 | P2 | ⬜ | SEO content pages | "CogAT testing dates by district," "What is HICAP," etc. — organic acquisition content. | Depends on E4-1 existing first |
| E6-4 | P3 | ⬜ | Opt-in badge/streak sharing | Careful, minimal sharing (e.g., a shareable image of a badge) — no student data beyond first name/avatar ever leaves the app. | Needs explicit privacy review before building |

---

## Epic 7 — B2B: tutoring centers & districts (P2/P3)

| ID | Pri | Status | Feature | Description / Acceptance Criteria | Notes |
|---|---|---|---|---|---|
| E7-1 | P2 | ⬜ | Org/seat account model | A license entity that owns multiple family accounts (a tutoring center or PTA), with a seat count and expiration. | New `organizations` table, families optionally linked to one |
| E7-2 | P2 | ⬜ | Org usage dashboard | Admin view for a center/district: seats used, completion rates across their families (aggregate only — not individual quiz answers, for privacy). | |
| E7-3 | P3 | ⬜ | Bulk roster import | CSV upload of student first-names/grades for an org to pre-populate seats. | |
| E7-4 | P3 | ⬜ | White-label theming | Swap logo/color tokens per org for a co-branded experience. | Low priority until a specific B2B deal needs it |

---

## Epic 8 — Platform & distribution (P2/P3)

| ID | Pri | Status | Feature | Description / Acceptance Criteria | Notes |
|---|---|---|---|---|---|
| E8-1 | P2 | ⬜ | PWA installability | Web app manifest + service worker so it can be "installed" to a phone home screen; cache the question bank for offline practice. | |
| E8-2 | P3 | ⬜ | Push notifications | Streak-risk and mock-test-reminder pushes, opt-in only. | Depends on E8-1 |
| E8-3 | P3 | ⬜ | Native app store listing | Wrap the PWA (Capacitor or similar) for iOS/Android app store discoverability. | Only worth it once organic web growth plateaus |

---

## Epic 9 — Grade 1 / CogAT Level 8 (P3, separate initiative)

Deliberately last, and deliberately its own epic rather than a row in Epic 5: grade 1's CogAT format is **not just easier, it's structurally different** — no Sentence Completion, no reading required at all. The Verbal battery is Picture Classification and Picture Analogies instead. That means this can't be built by reusing the existing text-based question shape with simpler words; it needs real image content and probably audio narration (a 6-year-old may not reliably read a prompt even if the questions themselves are pictures). Revisit this once Epic 5 has usage/revenue data to justify the separate investment.

| ID | Pri | Status | Feature | Description / Acceptance Criteria | Notes |
|---|---|---|---|---|---|
| E9-1 | P3 | ⬜ | Picture-based question format | New question type: image + image-option answers, no text required to answer. | This is a new rendering path in the quiz runner, not just new content |
| E9-2 | P3 | ⬜ | Audio narration | Prompts read aloud, matching how the real proctor-paced, audio-led CogAT format works at this age. | |
| E9-3 | P3 | ⬜ | Age-appropriate quiz UI | Bigger touch targets, simpler navigation, likely needs a parent/guardian present rather than fully independent use (unlike grades 3+). | Revisit the "kid operates this independently" assumption baked into the rest of the app for this age group specifically |
| E9-4 | P3 | ⬜ | Level 8 content bank | Picture Classification + Picture Analogies pools, via original imagery (not text templates from E5-1's pipeline — this needs its own authoring approach). | |

---

## How to use this with Claude Code

Feed it one row (or one epic) per session rather than the whole backlog at once — e.g., "Implement E1-1 through E1-5 from this backlog: set up Supabase, migrate the data model, and replace the Store layer in `cogat_prep_app.html`." Keep Epic 0's "known debt" note in front of Claude Code every time it touches auth or storage, so it doesn't quietly reintroduce the shared-blob pattern while refactoring something else.
