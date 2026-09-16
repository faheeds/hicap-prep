# Product Backlog — HiCap Prep (CogAT App)

This is written to be fed directly to Claude Code, one epic (or even one row) at a time. Epic 0 documents what already exists in `cogat_prep_app.html` so Claude Code doesn't rebuild it. Epics 1+ are new work, **ordered by priority** — build top to bottom unless a dependency forces a reorder (dependencies are called out per item).

### Legend
- **Status:** ✅ Done and verified against real infrastructure or real human testing &nbsp;|&nbsp; 🔧 Code complete, automated tests pass, NOT yet verified against live infrastructure/real usage &nbsp;|&nbsp; 🔶 Partially done / in progress &nbsp;|&nbsp; ⬜ Not started
- **Priority:** **P0** = launch blocker, can't charge money without it &nbsp;|&nbsp; **P1** = needed for a good paid launch &nbsp;|&nbsp; **P2** = needed to scale past the first pilot &nbsp;|&nbsp; **P3** = later / opportunistic
- **Effort:** S (hours) · M (1–3 days) · L (1–2 weeks) · XL (multi-week)

### Recommended build order (the short version)
1. **E1 — Backend & real accounts** (everything else depends on this)
2. **E2 — Compliance** (must ship alongside E1, not after — it's a launch blocker, not a checkbox)
3. **E4 — Paid-launch product gaps** (onboarding, security hardening, testing, naming decision, UI rebuild) — deliberately pulled ahead of E3 because none of its rows depend on payments and shipping visible progress matters more right now than finishing the paywall first
4. **E3 — Payments & paywall**
5. **E5 — Multi-grade content expansion, Grades 3–11** (this is what makes the Family Pass promise — "one price, every kid in the house" — actually true; see `docs/BUSINESS_PLAN.md` §3/§5)
6. **E6 — Growth & analytics**
7. **E7 — B2B / district & tutor licensing**
8. **E8 — Platform & distribution (PWA, app stores)**
9. **E9 — Grade 1 / CogAT Level 8** (separate initiative, picture-based format — deliberately last, see epic notes)

---

## Pending Human Verification

These items are code-complete and pass automated tests, but require a human or live external system to confirm the last mile. Nothing else is blocked on them — but they should not be counted as ✅ until checked.

| Item | What needs a human | Why automated isn't enough |
|---|---|---|
| SW update on a real installed session | Open the app on a phone where it was previously installed, deploy a new build, confirm page refreshes automatically with the new cache | Playwright test requires external network (sandbox-blocked); verified via curl only |
| Add to Home Screen on a real phone | Install via Safari/Chrome, reopen, confirm standalone mode + offline access work | Not testable in CI |
| Stripe test-mode walkthrough | Complete every step in the E3 pre-live checklist: three pass types, idempotency replay, payment-failure grace period with `4000 0000 0000 0341` | All webhook code is unit-tested; never exercised with real Stripe events |
| A real email from send-digest | Configure `RESEND_API_KEY` + `FROM_EMAIL`, invoke the function against a family with `email_reminders_opted_in = true`, confirm delivery | Resend API call never made against real credentials |
| A real PDF rendering legibly | Click "Print" on a student with history; confirm browser print preview is readable across Chrome/Safari | `buildProgressReportHTML()` has thorough unit tests; visual render is not testable in jsdom |
| Admin dashboard numbers against known values | Run `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ADMIN_SECRET=... npm test` against the live function; confirm fixture deltas match | Integration test written (`tests/admin-integration.test.mjs`); skips without env vars |
| A real Plausible event appearing | Set `PLAUSIBLE_DOMAIN` in Vercel env, accept consent banner, start a practice session, confirm event appears in Plausible dashboard | `plausibleDomain` not configured in production; `trackEvent()` is a no-op today |
| Kid validation: PF/FC Tier 1 rebuilds | Have a real Grade 7 student try the rebuilt nonverbal sets; confirm they're sensible and fair | Content quality can't be unit-tested |
| Kid validation: Level 11 Verbal pilot | Same — a real Grade 5 student on the 60 authored verbal questions | No student has tried them yet |
| privacy.html / terms.html human review | ✅ Completed |  |

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
| E1-1 | P0 | ✅ | Choose & stand up backend | Pick a backend (Supabase is the fastest path: Postgres + Auth + row-level security in one). Project created, connected. | In-repo scaffolding shipped (`supabase/config.toml`, `.env.example`, `src/config.example.js`, `config.local.js` gitignored, runtime loader in `src/app.html`). Hosted Supabase project created, linked, and all 18 migrations applied as of 2026-09-14. Three follow-up security migrations landed after initial deploy: `20260914000200_harden_function_security.sql` (search_path pinned on SECURITY DEFINER functions), `20260914000400_revoke_handle_new_user_from_public.sql` (PUBLIC execute revoke), `20260914000300_streak_last_date_to_date.sql` (type fix). Vercel deployment live at `https://hicapprep.com` (`vercel.json` + `scripts/gen-config.js`). |
| E1-2 | P0 | ✅ | Parent account auth | Email/password or magic-link signup & login for the **parent** (not the kid). Session persists across visits. | Supabase Auth; store session token client-side, gate parent-mode routes on it. **Done:** `src/supabase-client.js` (lazy CDN client with test escape hatch), `src/auth.js` (signUp / signIn / signInWithOtp / signOut / onAuthStateChange), auth gate in `authHTML()` blocks the entire app when unauthenticated in cloud mode, sign-out button in parent settings, session persistence via supabase-js's own localStorage. `tests/auth.test.mjs` covers the gate + sign-in/out lifecycle with a fake client |
| E1-3 | P0 | ✅ | Data model migration | Design real tables: `families`, `students` (include a `cogat_level` or `grade` column even though only Level 13 content exists yet — see Epic 5), `attempts` (history rows), `badges_earned`. One family = one parent account = private data. | Replace the single shared JSON blob with normalized tables; get the `grade` column in now so Epic 5 isn't a second migration. **Done:** `supabase/migrations/20260914000000_initial_schema.sql` defines all four tables + a `handle_new_user()` trigger that auto-creates a families row on signup + `grade`/`cogat_level` columns wired in from day one (grade constraint allows 1 or 3–11 per Epic 5/9). RLS is enabled here; the policies land in E1-4. `tests/schema.test.mjs` shape-checks the file |
| E1-4 | P0 | ✅ | Row-level security | A family can only ever read/write its own rows — enforced at the database level, not just in app logic. | Supabase RLS policies keyed on `auth.uid()`. **Done:** `supabase/migrations/20260914000100_row_level_security.sql` adds select/insert/update/delete policies to `families`/`students`/`attempts`/`badges_earned`, all keyed on `auth.uid()` and the family-owner subselect. `attempts` is intentionally UPDATE-locked (append-only history). Schema tests assert every table has an `auth.uid()`-keyed policy. **Verified:** a real two-family impersonation test confirmed one family's data is not readable by another family's JWT — not just policy review, actual cross-family SELECT attempt confirmed rejection. |
| E1-5 | P0 | ✅ | Replace `Store` layer | Swap every `window.storage`/`localStorage` call for real API calls (Supabase client SDK) behind the same `loadApp()`/`saveApp()` interface so the rest of the app barely changes. | This is the highest-leverage refactor — isolate it behind one module. **Done:** `src/store.js` exposes `Store.load()` / `Store.save()` / `Store.newId()`. Cloud path hydrates the APP snapshot from families/students/attempts and syncs back on save (upsert students, delete removed students, insert-only new attempts marked via `_saved` mirror flag). Local path preserves the pre-Epic-1 localStorage / window.storage blob byte-for-byte. app.html's `loadApp()`/`saveApp()` are one-line delegates now; `newStudentId()` uses `crypto.randomUUID()` in cloud mode. `tests/store.test.mjs` round-trips load → add student → submit attempt → save with a chainable Supabase stub |
| E1-6 | P0 | ✅ | Server-verified parent PIN | Move PIN check to a server function; never send/compare the PIN in client JS. Add basic rate limiting (e.g., lock out after 5 bad attempts for 5 minutes). | Supabase Edge Function or equivalent; store a hashed PIN, not plaintext. **Done:** `supabase/functions/verify-pin/index.ts` + `supabase/functions/set-pin/index.ts` (Deno) use `_shared/pin.ts` (PBKDF2-SHA256, 100k iterations, per-family salt, constant-time compare). verify-pin locks the family for 5 min after 5 bad attempts. `src/auth.js` adds `verifyPin()` / `setPin()` fetch wrappers. `tryPin()` in app.html hits the server in cloud mode and surfaces attempts-left / lockout-time in the error banner; first-time entry falls through to set-pin as a UX-preserving self-setup. `tests/pin.test.mjs` covers the client-side flow with a stubbed fetch; `tests/pin-hash.test.mjs` shape-checks the hash format |
| E1-7 | P0 | ✅ | Account & data deletion | A parent can permanently delete their family's account and all child data from one settings screen. | Required for COPPA/privacy compliance, not optional. **Done:** `supabase/functions/delete-account/index.ts` verifies the caller's JWT, explicitly deletes the family's badges/attempts/students/families rows (belt-and-suspenders around the ON DELETE CASCADE FKs), then calls `admin.auth.admin.deleteUser()`. Parent settings has a "Delete my family's account" button; `confirmDeleteAccount()` in `app.html` prompts, calls the edge function in cloud mode / wipes localStorage in local mode, then resets in-memory state and shows a receipt. `tests/delete-account.test.mjs` covers the flow with a stubbed fetch |
| E1-8 | P1 | ✅ | Data export | A parent can export their family's full history as JSON or CSV. | Supports both compliance and "I want my kid's data" trust-building. **Done:** parent-settings pane adds "Download JSON" and "Download CSV" buttons; `buildExportSnapshot()` serializes every student + full history (bySub + wrongQuestions preserved), `buildExportCSV()` flattens to a spreadsheet-friendly, RFC-4180-quoted row per attempt. Filenames stamped with the export date. Works identically in cloud and local mode since it's a pure function of APP. `tests/export.test.mjs` covers snapshot shape, CSV escaping, and blob-download plumbing |

---

## Epic 2 — Compliance & trust (P0, ship alongside Epic 1)

| ID | Pri | Status | Feature | Description / Acceptance Criteria | Notes |
|---|---|---|---|---|---|
| E2-1 | P0 | ✅ | Privacy Policy page | Real, specific privacy policy — what's collected (child's first name, avatar, quiz history), why, who can see it, how to delete it. | Don't use a generic template unedited — it needs to accurately describe what this app actually stores. **Done:** `src/privacy.html` written specifically for this app (§1 what we collect, §2 what we don't, §3 who sees it, §4 subprocessors, §5 COPPA consent, §6 retention, §7 deletion, §8 export). `app.html` gets a `legalFooterHTML()` shown on every page with the "not affiliated" disclaimer + Privacy Policy link (Terms link comes in E2-3). `tests/compliance.test.mjs` pins the required policy sections and footer contents |
| E2-2 | P0 | ✅ | COPPA-style parental consent flow | Before any child data is entered, the *parent* (verified via their own account) explicitly consents. Add a checkbox + timestamp logged. | This is the actual compliance mechanism, not just a policy page. **Done:** `consentHTML()` gate sits between auth and roster in cloud mode (locally is a no-op — no data collection to consent to). Two checkboxes required, submit disabled until both ticked. `Store.saveConsent(app)` UPDATES `families.consented_at` via the RLS-scoped update policy. Store.load hydrates `APP.consentedAt` from `families.consented_at`. Init reloads APP on auth state change so a fresh sign-in hydrates the family (silent regression fix from Epic 1). `tests/consent.test.mjs` covers gate visibility, disabled-state gating, and the UPDATE round-trip |
| E2-3 | P0 | ✅ | Terms of Service page | Standard ToS, written to match this product (seasonal pass terms, refund policy, no guarantee of test outcomes). | **Done:** `src/terms.html` covers eligibility, no-guarantee-of-outcomes disclaimer, Individual/Family Pass structure with a "season" definition, 14-day refund window on one-time passes + subscription cancel-anytime, acceptable use, liability limit. Footer link added to app.html and privacy.html cross-links to terms. `tests/compliance.test.mjs` asserts the required sections exist |
| E2-4 | P0 | ✅ | Trademark-safe disclaimers | "Not affiliated with or endorsed by Riverside Insights or CogAT" — footer of every page, plus landing page and app-store listing copy. | Avoid using the CogAT logo or exact trade dress anywhere. **Done:** disclaimer present in every public surface — `src/app.html` legal footer (rendered on every route including auth + consent), `src/privacy.html` footer, `src/terms.html` footer, `README.md` intro blockquote. All references to CogAT are nominative (identifying the test we prepare for). Trade-dress audit clean (no image assets in the repo at all). `tests/compliance.test.mjs` pins the disclaimer on all four files so a future surface can't silently ship without one. Landing page (E4-1) + app-store listing (E8-3) not yet built — those rows will carry the same disclaimer when they land |
| E2-5 | P1 | 🔶 | Data retention policy + auto-cleanup | Define and implement a retention window (e.g., auto-delete inactive family data after 18 months, with a warning email first). | **Partially done:** `supabase/migrations/20260914000500_retention_policy.sql` adds `families.retention_warned_at` + three SECURITY-DEFINER cron functions; `20260914000600_gate_retention_on_flag.sql` adds a `retention_automation_enabled` boolean flag to `app_settings` (default false) that gates the delete job. `retention_mark_warnings()` and `retention_clear_stale_warnings()` run safely (they write a column, nothing user-visible). `retention_delete_expired()` is hard-gated by the flag and must not be enabled until E4-4 (email reminders) is live-verified — the "warning email" promise is currently unmet because `retention_warned_at` is set but nothing surfaces it to the parent. **DO NOT flip `retention_automation_enabled = true` until:** `RESEND_API_KEY` is configured, send-digest is deployed and tested, and the notifier reads `retention_warned_at`. |
| E2-6 | P1 | ✅ | Cookie/analytics consent banner | Only needed once E6-3 (analytics) ships — gate it on that. | **Done:** `analyticsBannerHTML()`, `acceptAnalytics()`, `declineAnalytics()`, `shouldShowAnalyticsBanner()` added to `app.html`. Banner mounts outside `#app` so `render()` doesn't clobber it; consent stored in `localStorage["hicap-analytics"]` ("accepted" / "declined"). Identical banner wired inline into `src/landing.html`. Plausible script loaded only on accept and only when `plausibleDomain` is configured — cookieless, GDPR/COPPA-safe. `tests/analytics.test.mjs` covers consent state, banner HTML, `trackEvent()` no-op before consent, and landing page markup. |

---

## Epic 3 — Payments & paywall (P0/P1)

**Status note:** All E3 rows are code-complete and security-hardened (entitlement self-grant exploit found and fixed via `20260914000900_stripe_security.sql`; webhook signature verification, idempotency, and payment-failure grace period all tested in unit tests). None have been connected to real Stripe keys. The CLAUDE.md guardrail explicitly blocks switching to live mode until the pre-live checklist below is completed against the hosted DB with test-mode keys. Do not change these rows to ✅ until that walkthrough happens.

| ID | Pri | Status | Feature | Description / Acceptance Criteria | Notes |
|---|---|---|---|---|---|
| E3-1 | P0 | 🔧 | Stripe integration | Stripe account connected, test mode working end to end. | **Done:** `.env.example` documents all required Stripe env vars (STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_INDIVIDUAL, STRIPE_PRICE_FAMILY, STRIPE_PRICE_ANNUAL). `supabase/functions/create-checkout/index.ts` creates Checkout sessions for the three pass types, creates/reuses Stripe Customer, stores customer ID in families. `supabase/functions/stripe-webhook/index.ts` handles checkout.session.completed / customer.subscription.updated / customer.subscription.deleted; verifies Stripe-Signature; computes season expiry (July 31 current/next school year) for one-time passes. `supabase/migrations/20260914000800_stripe_entitlements.sql` adds pass_type, pass_student_id, pass_expires_at, stripe_customer_id, stripe_subscription_id to families. **Manual setup required** (see `.env.example`): create Stripe account, enable test mode, create three products/prices, configure webhook endpoint at `<SUPABASE_URL>/functions/v1/stripe-webhook`, set all keys as Supabase project secrets, deploy edge functions, apply migration to hosted DB, activate Customer Portal in Stripe dashboard. |
| E3-2 | P0 | 🔧 | Individual Pass purchase | One-time $49 Checkout session → webhook → mark family entitled for 1 student, current season. | **Done:** create-checkout handles `priceType: 'individual'`; webhook sets `pass_type = 'individual'`, `pass_student_id`, `pass_expires_at = July 31 season expiry`. `tests/payments.test.mjs` asserts `isEntitled(sid)` is true only for the named student and false for others with an individual pass. |
| E3-3 | P0 | 🔧 | Family Pass purchase | One-time $79 Checkout session → unlimited students on the roster. | **Done:** create-checkout handles `priceType: 'family'`; webhook sets `pass_type = 'family'` with season expiry. Tests assert all students are entitled with a family pass. |
| E3-4 | P0 | 🔧 | Entitlement gating in-app | Free tier: browse mode + 1 practice subtest/day, no mocks, no full program. Paid: everything unlocked. Gate checked server-side, not just hidden in the UI. | **Done:** `isEntitled(studentId)` in app.html reads server-loaded APP.passType/passExpiresAt/passStudentId (hydrated from Supabase, not forgeable client-side). `freePracticeCountToday(sid)` counts today's practice-kind history entries in local time. `showPaywall(context)` / `paywallModalHTML()` / `startCheckout(priceType, studentId)` form the paywall UI (prices shown: $49 individual, $79 family, $129 annual). Gates added to `launchProgramDay`, `launchPracticeOne` (≥1 free practice today), `openMockConfig` (any student entitled check). Free-tier banner shown on dashboard. `parentPlanHTML()` shows current pass status + "Manage subscription" or "Get full access" CTAs. Stripe success detection in `init()` reloads APP and shows a confirmation alert on `?stripe_success=1`. `tests/payments.test.mjs` covers all pass types, expiry, individual scoping, UI rendering, and gate enforcement. |
| E3-5 | P1 | 🔧 | Annual auto-renew Family Pass | $129/year Stripe Subscription option, cancel-anytime. | **Done:** create-checkout handles `priceType: 'annual'` as a recurring Stripe Subscription. Webhook handles `customer.subscription.updated` (updates pass_type = 'family_annual', pass_expires_at = subscription period_end) and `customer.subscription.deleted` (resets to free). paywallModalHTML shows "Annual Family Pass — $129/year, cancel anytime" button. |
| E3-6 | P1 | 🔧 | Receipt & confirmation email | Automated email on purchase (Stripe can trigger this, or a simple transactional email service). | **Done (zero code):** Stripe natively sends receipt emails after successful payments. Enable in Stripe dashboard: Settings → Emails → "Successful payments" toggle. No custom code needed. |
| E3-7 | P1 | 🔧 | Promo/discount codes | Support a code at checkout (for pilot families, referrals). | **Done:** `allow_promotion_codes: true` in create-checkout session creation. Stripe Coupons created in the dashboard are automatically accepted at checkout. |
| E3-8 | P2 | 🔧 | Refund/cancellation self-service | Parent can request a refund or cancel a subscription from account settings without emailing support. | **Done:** `supabase/functions/create-portal-session/index.ts` creates a Stripe Customer Portal session for the authenticated parent (looks up stripe_customer_id from families). `openBillingPortal()` in app.html calls it and redirects. "Manage subscription" button added to `parentPlanHTML()`. Portal allows subscription cancellation, payment method updates, invoice history, and refund requests. **Manual setup:** activate Customer Portal in Stripe dashboard (Settings → Billing → Customer Portal → Activate). |

### Pre-live verification checklist (required before switching to live mode or inviting any real customer)

All steps must be completed in Stripe **test mode** against the **hosted Supabase DB** (not a local emulator). Do not proceed to live mode until every item below is checked off.

**Setup prerequisites** (see `.env.example` for exact steps)
- [ ] Stripe test-mode keys, all three price IDs, and the webhook signing secret are set as Supabase project secrets
- [ ] Migration `20260914000800_stripe_entitlements.sql` applied to hosted DB (adds entitlement columns)
- [ ] Migration `20260914000900_stripe_security.sql` applied to hosted DB (adds entitlement trigger + processed_events table)
- [ ] Edge functions deployed: `create-checkout`, `stripe-webhook`, `create-portal-session`
- [ ] Webhook endpoint registered in Stripe dashboard for `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- [ ] Customer Portal activated in Stripe dashboard (Settings → Billing → Customer Portal)

**Pass purchase flows**
- [ ] Buy an Individual Pass ($49, test card `4242 4242 4242 4242`): confirm `pass_type = 'individual'` and `pass_student_id` set correctly in the families row, and that only the named student gains access in the app
- [ ] Buy a Family Pass ($79, same test card): confirm `pass_type = 'family'`, all roster students gain access
- [ ] Buy an Annual Family Pass ($129, same test card): confirm `pass_type = 'family_annual'`, `stripe_subscription_id` set, `pass_expires_at` matches the subscription's `current_period_end`

**Duplicate-event idempotency**
- [ ] In the Stripe dashboard, resend a `checkout.session.completed` event that already processed: confirm `pass_type` is unchanged and no duplicate row appears in `stripe_processed_events`

**Payment failure + grace period (the critical sequence)**
- [ ] Create an Annual Pass subscription using the always-fails-on-renewal test card (`4000 0000 0000 0341`). In Stripe test mode, advance the subscription's billing date (Dashboard → Subscriptions → [sub] → "Skip trial" or use the clock feature) to trigger a renewal failure.
- [ ] Confirm `invoice.payment_failed` fired: `pass_expires_at` in the families row must be approximately 7 days in the future (grace period), NOT the past renewal date.
- [ ] Confirm the concurrent `customer.subscription.updated` (status: `past_due`) did NOT overwrite the grace period.
- [ ] Simulate Smart Retries exhausted: in the Stripe dashboard, cancel the subscription manually to trigger `customer.subscription.deleted`. Confirm `pass_type` reverts to `'free'` and `pass_expires_at` is cleared.

**Entitlement self-grant protection**
- [ ] Using a browser with your own JWT (from the app's session), attempt a direct PATCH to the families row setting `pass_type = 'family'` via the Supabase REST API. Confirm the request returns `403 insufficient_privilege` and the families row is unchanged.

**Billing portal**
- [ ] Click "Manage subscription" in parent settings: confirm redirect to the Stripe Customer Portal.
- [ ] Cancel the annual subscription from the portal: confirm `customer.subscription.deleted` fires and `pass_type` reverts to `'free'` in the app.

---

## Epic 4 — Paid-launch product gaps (P1)

| ID | Pri | Status | Feature | Description / Acceptance Criteria | Notes |
|---|---|---|---|---|---|
| E4-1 | P1 | ✅ | Landing page / onboarding | A real first-visit page explaining what this is, for someone who's never seen it — currently the app assumes the visitor already knows. | Separate from the app shell; this is the marketing entry point. **Done:** `src/landing.html` with the exact copy blocks from this row's spec (hero, "why we built it," four feature panels, tinted trust block linking to privacy.html, closing CTA + "currently built for Grade 7" note, standard legal footer). Same header shell + design tokens + Cormorant/Lora fonts as `src/app.html` so the two surfaces read as one product; no student chip or lock icon (no session on landing). Primary + closing CTAs both link `app.html#signup`; `AUTH_UI` initial mode now reads `location.hash === "#signup"` so the deep-link lands on the sign-up form instead of sign-in. No pricing anywhere (Epic 3 unshipped). **Note:** landing page was substantially rebuilt once after a design critique — hero mockup panel, colored icon cards, a documented `.btn-solid` exception to the outline-only button rule (scoped to this page only). `tests/compliance.test.mjs` asserts both the disclaimer presence and the no-`$`/no-billing-language constraint |
| E4-2 | P1 | ✅ | Automated regression tests | Formalize the manual `node`/`jsdom` smoke tests already used during development into a real test suite (scoring logic, random sampling, timer auto-submit, modal flows). | **Done:** 300+ tests across test files under `tests/`, all four items from the checklist covered by name. Runs via `npm test` (Node's built-in test runner + jsdom). Playwright added for E2E tests in `tests-e2e/` (separate `npm run test:e2e`). |
| E4-3 | P1 | ✅ | Accessibility pass | Keyboard navigation through the quiz runner, ARIA labels on custom controls, color-contrast check on the palette. | **Done:** universal `:focus-visible` rule, `prefers-reduced-motion` support, `<main>` landmark, `role="dialog"` on modals, correct `role="radiogroup"`/`role="radio"` on segmented pickers, `role="timer" aria-live="off"` on mock timer bar, contrast fixes. **Deliberate decision:** mock timer uses `aria-live="off"` — user explicitly chose not to announce every second to screen readers; this is a proportionality call, not an oversight. `tests/a11y.test.mjs` locks 11 regression guards. **Also in this era:** a real PIN-keypad bug (fully non-functional after one digit, despite passing tests) was found and fixed — permanent case-study note in CLAUDE.md. |
| E4-4 | P2 | 🔧 | Email reminders | Optional weekly digest to parents ("3 lessons left this week") and streak-risk nudges. | **Code done:** `supabase/migrations/20260914000700_email_reminders.sql` adds `email_reminders_opted_in` + `retention_email_sent_at` to families. `supabase/functions/send-digest/index.ts` (Deno, Resend API) handles weekly digest + retention warning emails. `src/store.js` adds `Store.saveEmailPreference()`. Parent settings shows opt-in toggle. **Not live-verified:** Resend API call never made against real credentials; `RESEND_API_KEY` not confirmed set in Supabase secrets. **Unblocks:** E2-5 retention delete automation (`retention_automation_enabled` flag must stay false until this is live-verified). Manual setup: Resend account, verified sender domain, `RESEND_API_KEY`/`FROM_EMAIL`/`CRON_SECRET` as Supabase project secrets, deploy send-digest, set up weekly cron. |
| E4-5 | P2 | 🔧 | Printable PDF progress report | One-click export of a student's program progress + mastery bars, useful for parents sharing with a tutor. | **Code done:** `buildProgressReportHTML(st)` generates a self-contained print-ready HTML document (completion ring SVG, mastery bars per strand, badges earned, last 10 sessions, disclaimer footer). `printProgressReport(studentId)` opens it in a new window and auto-calls `window.print()` after 400ms. `tests/pdf-report.test.mjs` covers: function existence, full HTML document shape, student name, disclaimer, strand labels, session rows, empty-state handling, and a rich fixture test verifying exact mastery percentages (90%/85%/80%), specific earned/not-earned badges, and real score rows in the table. **Not human-verified:** visual print preview legibility not confirmed. |
| E4-6 | P1 | ✅ | Decide product name/brand for multi-grade scope | **Decided: renamed to "HiCap Prep."** Applied to `README.md`, `CLAUDE.md`, `package.json`, `.devcontainer/devcontainer.json`, and the app's `<title>`/header in `src/app.html`. | Remaining follow-through, not urgent: the repo/GitHub project name, any future Stripe product names, and a domain name still need to catch up when convenient — none of that blocks other epics |
| E4-7 | P1 | ✅ | Rebuild UI to match the design system | Extract the design system from docs/design/ into `docs/DESIGN_SYSTEM.md`. Rebuild `src/app.html` CSS and markup to match — keep all existing JS logic untouched. | **Done:** `docs/DESIGN_SYSTEM.md` extracted; `src/app.html` rebuilt with full design system (dark-ink header, 3-tab shell, completion ring, mastery bars, badge grid, quiz runner, PIN gate, parent dashboard). **Note:** grade picker was added to the roster UI ahead of schedule (part of the E4-7 rebuild) but restricted to `[7]` only as a stopgap — it uses `GRADE_OPTIONS = [7]` until a second complete content bank ships. This predates E5-0's formal grade-level system and was never tracked as its own row; it's a tracked known stopgap. **Also in this era:** a real PIN-keypad bug (keypad non-functional after one digit) was found and fixed here. |

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
| E5-0 | P1 | ✅ | **Data model refactor: add a level dimension** | `DRILLS` is currently keyed `battery → tier → subtest`. Add `level` as the outermost key: `DRILLS[cogatLevel][battery][tier][subtest]`. Thread a `level` parameter through every function that reads it: `sampleQuestions`, `collectQuestions`, `collectMixedSpeed`, `collectMock`, `weekPlan`. Add a grade/level field to the student roster (parent sets it once when adding a student; map grade → CogAT level via the table above). | **Done:** `DRILLS` now keyed `{13: {verbal: ..., quant: ..., nonverbal: ...}}`. All five functions updated. `effectiveLevel(level)` helper falls back to 13 for levels without a content bank yet (prevents crashes; emits a visible `console.warn` — not a silent fallback). `GRADE_OPTIONS` stays `[7]` until a second complete bank ships. `tests/level.test.mjs` covers all the above (12 tests). |
| E5-0b | P1 | ✅ | **Shuffled-bag question sampling** | Eliminate inter-session question repeats by drawing from a persistent per-student pool that cycles only after exhaustion. | **Done:** `supabase/migrations/20260914001000_pool_cursors.sql` adds `pool_cursors jsonb` to students. `drawFromBag(level, battery, tier, sub, n, cursors)` tracks the per-pool cursor; `store.js` reads and writes `pool_cursors` in cloud mode. `tests/smoke.test.mjs` verifies cursor isolation between students and that the pool exhausts before cycling. This shipped as an untracked change; recorded here retroactively. |
| E5-1 | P1 | ⬜ | Reusable content-authoring pipeline | Formalize the Python/JSON merge process already used to build the Level 13 bank into a repeatable script: define a question "template" per subtest type (e.g. "word-relationship analogy," "double-then-subtract-one number series"), recalibrate vocabulary/number ranges per grade level, generate the pool. | This already exists informally from Level 13's development — the highest-leverage row after E5-0, since every level bank after this reuses it |
| E5-2 | P1 | ⬜ | Nonverbal (FC/FM/PF) recalibration pass | Nonverbal/spatial-reasoning content transfers across grades with light recalibration (more shapes/steps at harder levels) rather than full re-authoring — unlike Verbal and Quant, which need real grade-level tuning. Confirm this holds and build the lighter-weight recalibration path first. | Cheapest win in the epic — do this before the heavier Verbal/Quant authoring work per level |
| E5-3 | P1 | ⬜ | CogAT Level 12 bank (grade 6) | 9 subtests × 3 tiers × 20 questions, via the E5-1 pipeline. | Build first — closest in difficulty to the already-tuned Level 13 content, and the most likely immediate sibling-upsell (a grade-7 family often has a grade-6 kid at home) |
| E5-4 | P1 | ⬜ | CogAT Level 14 bank (grade 8) | Same. | Same rationale as E5-3, other direction |
| E5-5 | P2 | 🔶 | CogAT Level 11 bank (grade 5) | Same. | **Pilot status:** 60 verbal Tier 1 questions authored (DRILLS[11].verbal[1]) — that's 1 of 9 required subtest/tier banks. Quant and Nonverbal for Level 11 are ⬜. `GRADE_OPTIONS` does NOT include grade 5 — the CLAUDE.md guardrail requires all 9 banks before the picker can be exposed. No student has tried the authored questions yet. |
| E5-6 | P2 | ⬜ | CogAT Level 15 bank (grade 9) | Same. | |
| E5-7 | P2 | ⬜ | CogAT Level 9 bank (grade 3) | Same. | Furthest from Level 13 in vocabulary/complexity — expect more authoring time per pool than E5-3/E5-4 |
| E5-8 | P2 | ⬜ | CogAT Level 10 bank (grade 4) | Same. | |
| E5-9 | P2 | ⬜ | CogAT Level 16 bank (grade 10) | Same. | |
| E5-10 | P2 | ⬜ | CogAT Level 17 bank (grade 11) | Same. | |
| E5-11 | P1 | ⬜ | Level selector in the UI | Browse mode and the free-practice picker need a grade/level selector alongside battery/tier. The 10-week program already reads a student's assigned level implicitly once E5-0 lands — just needs the roster "add student" form to capture it. | Depends on E5-0 |
| E5-12 | P2 | ⬜ | Grow existing pools further (any level) | Use real usage data — are families exhausting a level's pools within a season? — to decide if 20/pool needs to grow for that level. | Data-driven, per level — don't do this speculatively across the board |

### Nonverbal content quality track

This track consumed significant effort and has its own standards document (`docs/ITEM_WRITING_STANDARDS.md`). It is explicitly paused by user decision — resuming requires a specific trigger (kid validation data or a user decision to continue). Track separately from the grade-expansion work above since the work here is content quality, not multi-grade expansion.

| Item | Status | Notes |
|---|---|---|
| PF Tier 1 (Paper Folding) | ✅ | Rebuilt with real programmatic SVG geometry; 1-, 2-, and 3-fold puzzles. Two real bugs found and fixed: axis-collapse duplicate-option bug, and a D4-symmetry-group redundancy that caused duplicate items pool-wide. Geometric uniqueness test in `tests/smoke.test.mjs`. |
| FC Tier 1 (Figure Classification) | ✅ | Rebuilt with 8 rule types per the item-writing rubric (20 items, rubric-audited). Still glyph-based (SVG pass not done — glyph characters work but are not the same quality as programmatic geometry). Open item: FC SVG rebuild, if kid feedback shows confusion. |
| FC/PF Tiers 2–3 | ⬜ | Pre-rubric; not started. |
| Figure Matrices (FM) all tiers | ⬜ | Pre-rubric; not started. |
| Kid validation: PF/FC Tier 1 | Pending human | See Pending Human Verification table above. |

---

## Epic 6 — Growth & analytics (P1/P2)

| ID | Pri | Status | Feature | Description / Acceptance Criteria | Notes |
|---|---|---|---|---|---|
| E6-1 | P1 | 🔧 | Founder funnel dashboard | Track signup → free-usage → paid conversion, and program/mock completion rates. This is the data the business plan's financial model depends on. | **Done:** `supabase/functions/admin-metrics/index.ts` — ADMIN_SECRET-protected GET endpoint that queries families/students/attempts in parallel and returns JSON: `families.{total, paid, free, conversionPct, signupsLast7Days, signupsLast30Days}`, `students.total`, `attempts.{total, practice, program, mock, review}`. `src/admin.html` — standalone admin page with metric cards. `tests/admin.test.mjs` covers auth guard, DB query presence, response shape. `tests/admin-integration.test.mjs` — fixture-based live integration test (creates 2 auth users, 2 families, 2 students, 6 attempts; asserts exact count deltas; deletes everything in `after()`). **Not live-verified:** integration test skips without `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`ADMIN_SECRET` env vars; admin dashboard numbers not yet checked against a live function call with known values. |
| E6-2 | P2 | ✅ | Referral program | Give-a-discount/get-a-discount code shared between families. | **Done:** `supabase/migrations/20260914001100_referral_program.sql` adds referral columns. `src/store.js` performs one-time referral capture and exposes codes in APP snapshot. Landing + app pages capture `?ref=CODE`. Stripe webhook increments referrer count on purchase. **Security note:** a real vulnerability was found and fixed — referral columns were initially writable by any authenticated client. `20260914001200_referral_write_protection.sql` added write-once RLS policy; `tests/referral.test.mjs` includes a rejection test. |
| E6-3 | P2 | 🔧 | Basic analytics | Lightweight page-view and event tracking. Privacy-first: Plausible Analytics (cookieless, no PII). | **Code done:** `analyticsConsent()`, `trackEvent()`, consent banner all wired. `config.example.js` documents `PLAUSIBLE_DOMAIN`. **Not live:** `plausibleDomain` not configured in Vercel env; `trackEvent()` is a no-op in production today. No real Plausible event has ever fired. |
| E6-4 | P2 | ✅ | SEO content pages | "CogAT testing dates by district," "What is HICAP," etc. — organic acquisition content. | **Done:** Three static pages in `src/`: `cogat-guide.html`, `gifted-testing.html`, `testing-dates.html`. All match design tokens, carry trademark disclaimer, link to `app.html#signup`, cross-link each other, breadcrumb navigation. `tests/seo-pages.test.mjs` covers all the above. |
| E6-5 | P3 | ✅ | Opt-in badge/streak sharing | Careful, minimal sharing — no student data beyond first name/avatar ever leaves the app. | **Done:** `shareBadge(firstName, badgeName)` via Web Share API + clipboard fallback. Share text contains only first name + badge name. **Real gap found and fixed:** badge sharing existed before `privacy.html` mentioned it — disclosure added covering what's shared (first name + badge name only), opt-in nature, and parent mitigation path. **Deliberate decision:** not gated by parent PIN — user decided this is a proportionality call (the child is choosing to share their own badge name; no sensitive data leaves). |

---

## Epic 7 — B2B: tutoring centers & districts (P2/P3)

| ID | Pri | Status | Feature | Description / Acceptance Criteria | Notes |
|---|---|---|---|---|---|
| E7-1 | P2 | ✅ | Org/seat account model | A license entity that owns multiple family accounts (a tutoring center or PTA), with a seat count and expiration. | **Done:** `organizations` table (id uuid pk, name not null, slug unique nullable, seat_count integer check≥0, seat_expires_at nullable, owner_user_id → auth.users, created_at). `families.organization_id` uuid FK → organizations ON DELETE SET NULL, write-protected by the extended `block_entitlement_self_grant` trigger. Two SELECT-only RLS policies on organizations. Migration `20260914001300_org_accounts.sql` applied to hosted DB. 22 tests in `tests/org.test.mjs`. |
| E7-2 | P2 | ✅ | Org usage dashboard | Admin view for a center/district: seats used, completion rates across their families (aggregate only — no individual quiz answers, for privacy). | **Done:** `get_org_stats(p_org_id)` SECURITY DEFINER RPC (ownership check first, search_path pinned, no student names or wrong_questions in output, COALESCE families to []). `my_owned_orgs` view. `store.js` extended with `loadOrgStats(orgId)`. UI: `orgDashboardSectionHTML()` in `parentHomeHTML()`. Migration `20260914001400_org_dashboard.sql` applied. 17 tests in `tests/org-dashboard.test.mjs`. **Security verified in tests:** ownership check position-verified; anon excluded from execute; positive-assertion shape test confirms only aggregate keys appear in per-family jsonb (no student names, no individual answers). |
| E7-3 | P3 | ✅ | Bulk roster import | CSV upload of student first-names/grades for an org to pre-populate seats. | **Done:** `org_roster_entries` table with INSERT (org owner only, WITH CHECK), SELECT (owner+member). `parseOrgCsv(text)` validates name and grade (1–12). CSV upload UI in org dashboard. store.js `importOrgRoster` inserts rows. Migration `20260914001500_org_roster.sql` applied. **Hardened:** `20260914001700_org_roster_deny_write.sql` adds explicit RESTRICTIVE `USING(false)` policies for UPDATE and DELETE — defense-in-depth beyond the default-deny baseline. 26 tests in `tests/org-roster.test.mjs` including UPDATE and DELETE rejection tests. |
| E7-4 | P3 | ✅ | White-label theming | Swap logo/color tokens per org for a co-branded experience. | **Done:** `theme_overrides jsonb` column on organizations (service-role-only write; excluded from authenticated UPDATE policy). `applyOrgTheme(overrides)` enforces a strict whitelist (`--flare`, `--lagoon`, `--violet`, `--ink`, `--bg`); non-whitelisted tokens logged and skipped. Called in `init()` after every `APP = await loadApp()`. Migration `20260914001600_org_theme.sql` applied. 16 tests in `tests/org-theme.test.mjs` including JSDOM behavioral tests. |

---

## Epic 8 — Platform & distribution (P2/P3)

| ID | Pri | Status | Feature | Description / Acceptance Criteria | Notes |
|---|---|---|---|---|---|
| E8-0 | P2 | ✅ | Production deployment | App live at `https://hicapprep.com` on Vercel. | **Done:** `vercel.json` (buildCommand: gen-icons + gen-config, outputDirectory: src, `/` → `landing.html`). `scripts/gen-config.js` generates `src/config.local.js` from Vercel env vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PLAUSIBLE_DOMAIN`). Supabase auth redirect URLs and site_url configured for the domain. This predates/enabled every other E8 row and was never tracked as its own item — recorded here retroactively. |
| E8-1 | P2 | 🔧 | PWA installability | Web app manifest + service worker so it can be "installed" to a phone home screen; cache the question bank for offline practice. | **Code done:** `src/manifest.webmanifest`, `src/sw.js` (precache install, cache-first fetch, activate-event old-cache cleanup). `scripts/gen-icons.js` generates PNG icons at build time. SW registration in app.html and landing.html. **Two real bugs found and fixed:** (1) static CACHE_NAME `"hicap-v1"` would never update on deploy — replaced with build-time UTC timestamp injected by gen-config; (2) `config.local.js` was being cache-first served, causing auth failures — explicitly excluded from SW. **Playwright E2E test written** (`tests-e2e/sw-update.spec.js`): automates the full update cycle (plant stale caches, intercept sw.js re-fetch, inject new CACHE_NAME, assert old/stale caches purged and new cache present). **Not live-verified:** Playwright test requires external network access (sandbox-blocked); the "already-installed user gets updated automatically" scenario has only been verified via curl, not a real browser session. This is a meaningful distinction — a returning installed user is the only scenario that exercises the real update path. |
| E8-2 | P3 | ⬜ | Push notifications | Streak-risk and mock-test-reminder pushes, opt-in only. | Depends on E8-1 installability confirmed on a real phone |
| E8-3 | P3 | ⬜ | Native app store listing | Wrap the PWA (Capacitor or similar) for iOS/Android app store discoverability. | Only worth it once organic web growth plateaus |

---

## Epic 9 — Grade 1 / CogAT Level 8 (P3, separate initiative)

Deliberately last, and deliberately its own epic rather than a row in Epic 5: grade 1's CogAT format is **not just easier, it's structurally different** — no Sentence Completion, no reading required at all. The Verbal battery is Picture Classification and Picture Analogies instead. That means this can't be built by reusing the existing text-based question shape with simpler words; it needs real image content and probably audio narration (a 6-year-old may not reliably read a prompt even if the questions themselves are pictures). **Gating condition:** revisit once Epic 5 has usage/revenue data to justify the separate investment — the user was asked if there's a specific personal reason to start earlier and has not confirmed one.

| ID | Pri | Status | Feature | Description / Acceptance Criteria | Notes |
|---|---|---|---|---|---|
| E9-1 | P3 | ⬜ | Picture-based question format | New question type: image + image-option answers, no text required to answer. | This is a new rendering path in the quiz runner, not just new content |
| E9-2 | P3 | ⬜ | Audio narration | Prompts read aloud, matching how the real proctor-paced, audio-led CogAT format works at this age. | |
| E9-3 | P3 | ⬜ | Age-appropriate quiz UI | Bigger touch targets, simpler navigation, likely needs a parent/guardian present rather than fully independent use (unlike grades 3+). | Revisit the "kid operates this independently" assumption baked into the rest of the app for this age group specifically |
| E9-4 | P3 | ⬜ | Level 8 content bank | Picture Classification + Picture Analogies pools, via original imagery (not text templates from E5-1's pipeline — this needs its own authoring approach). | |

---

## How to use this with Claude Code

Feed it one row (or one epic) per session rather than the whole backlog at once — e.g., "Implement E1-1 through E1-5 from this backlog: set up Supabase, migrate the data model, and replace the Store layer in `cogat_prep_app.html`." Keep Epic 0's "known debt" note in front of Claude Code every time it touches auth or storage, so it doesn't quietly reintroduce the shared-blob pattern while refactoring something else.
