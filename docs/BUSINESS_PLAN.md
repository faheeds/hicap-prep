# Business Plan: Level 13 Prep — CogAT & Gifted-Test Readiness Platform

*Draft v1 — prepared as a working document, not a finished investor deck*

---

## 1. Executive Summary

Level 13 Prep is a web-based practice platform that helps families prepare kids for cognitive-abilities admissions tests (CogAT and similar assessments) used by school districts nationwide for gifted/highly-capable program placement. The current build is a working prototype: a 540-question adaptive bank, a 10-week guided program, family/roster support, gamified progress tracking, and parent-controlled timed mock exams.

The opportunity is a large, underserved, and currently fragmented market: parents spend meaningfully on gifted-test prep (tutors, workbooks, one-off courses) with few well-built, affordable, digital-first options. This plan lays out how to turn the existing prototype into a monetizable product, who to sell it to, how to price it, what needs to be fixed before charging money for it, and a realistic first-90-days path to revenue.

**Core recommendation:** launch as a seasonal, per-family paid product (not a year-round subscription), sold direct to parents first in one or two pilot districts, before pursuing tutoring-center and school-district licensing as a second-stage B2B channel.

---

## 2. The Problem

Roughly a third of U.S. states and hundreds of individual districts run gifted/advanced-learning identification programs that gate admission behind a cognitive abilities test — most commonly the CogAT (Riverside Insights), with OLSAT and NNAT also common. These tests are high-stakes for families (they determine years of a child's school placement) and low-transparency (the tests measure reasoning patterns kids have rarely practiced in school).

Parents currently have three options, each with real gaps:

| Option | Gap |
|---|---|
| Private tutors ($75–150/hr) | Expensive, inconsistent quality, doesn't scale to multiple kids |
| Static workbooks / PDF packets (Etsy, TPT, TestingMom-style sites) | No adaptivity, no scoring, no sense of progress, same worksheet every time |
| Nothing / winging it | Kids walk in cold to a format (timed, computer-based, proctor-paced) they've never seen |

None of the existing options combine **structured pacing** (so parents don't have to design a study plan themselves), **genuine variety** (so kids aren't memorizing answers), and **family-level economics** (most families prepping a kid for HICAP have a sibling coming up behind them in a year or two).

---

## 3. Product & Differentiation

What's already built, and why each piece matters commercially:

- **540-question bank across 3 tiers and 9 subtests**, randomly sampled every session — the single biggest complaint about competing workbooks is "it's the same 50 questions," and this is already solved.
- **10-week guided program** mapped to a real testing calendar — turns "here's a pile of questions" into "here's what to do today," which is the actual thing parents are willing to pay for over free content.
- **Multi-child roster** — most target customers have 2+ kids who will eventually go through this; a family-priced product converts better than a per-seat one.
- **Parent-gated, timed mock tests** — addresses the single highest-leverage prep factor (comfort under a countdown clock) and gives parents a supervisory role, which matters for trust.
- **Effort-based leaderboard and badges** — gamification without turning it into an accuracy-shaming contest, which is a deliberate and defensible design choice for a product marketed to parents who are (rightly) sensitive about kids' self-esteem around testing.

**What still needs to be built before this can be sold** (see Section 8) — most importantly, real accounts and a real backend. The current version stores all data in a single shared bucket tied to whoever has the link; that's fine for a family pilot, not for a paid product with strangers' children's data in it.

---

## 4. Market

**Primary customer:** parents of K–8 kids in districts that screen for gifted/advanced-learning placement via a cognitive test, actively preparing for an upcoming test window.

**Secondary customers (Phase 2 revenue):**
- Independent tutoring centers and learning centers, as a licensed tool they resell or bundle into packages.
- School districts or PTAs, as an approved/recommended prep resource (some districts explicitly avoid endorsing prep at all — this needs district-by-district diligence, not a blanket assumption).
- Homeschool co-ops and umbrella schools, who often independently seek out enrichment/testing prep content.

**Market sizing (directional, not precise):** CogAT alone is administered to well over a million students annually across the districts that use Riverside Insights products, with a meaningful subset going through parent-initiated (not just school-initiated) referral and prep, especially in districts — like Bellevue — with dense, prep-motivated communities. Even a small single-digit-percent share of "parents who would pay for structured prep" in a few hundred target districts represents a real business, without needing to win the whole national market on day one.

**A natural first market:** you're already inside the exact community this product is built for. Bellevue School District families going through HICAP testing are the same demographic Local Bigger Burger already serves in that neighborhood — that's a genuine, low-cost pilot distribution channel (in-store flyer, QR code at checkout, a mention in any parent-facing communication) before spending a dollar on paid acquisition elsewhere.

---

## 5. Business Model & Pricing

**Recommendation: seasonal pass, not a year-round subscription.**

Prep activity is sharply seasonal — it clusters in the 8–14 weeks before a district's testing window, then drops to near zero. A monthly subscription will show brutal churn the week after the test. A seasonal pricing model matches how the customer actually experiences the product and converts better on both ends (easier "yes" up front, no awkward cancel-fight later).

| Tier | Price (illustrative) | What's included |
|---|---|---|
| **Free** | $0 | Browse mode only (read questions + explanations), 1 practice subtest/day, no mock tests, no program tracking |
| **Individual Pass** | $49 one-time / testing season | Full 10-week program, full question bank, 1 child, unlimited practice, 2 mock tests |
| **Family Pass** | $79 one-time / testing season | Everything above, unlimited children on one roster, all 5 mock tests, parent dashboard |
| **Family Pass — Annual** | $129/year | Family Pass, renews automatically each testing season — aimed at families with multiple kids spread across grades over several years |
| **Tutor / Center License** | Custom, ~$300–1,500/year per location | White-label option, bulk student seats, usage reporting for the center's own parents |
| **District/PTA License** | Custom | Bulk family passes distributed through the district or PTA at a negotiated rate; typically the district or PTA pays, not individual families |

This uses the existing multi-student architecture directly — the "Family Pass" is exactly the roster feature you already built, just metered.

**Secondary revenue ideas (later, not day one):**
- Add-on levels for other grades once the bank is expanded (a family with a 4th grader and a 7th grader buys two passes).
- Printable "cheat sheet" PDF add-on for offline practice.
- Affiliate/referral credit: refer another family, both get a discount — leverages the fact that HICAP prep is a communal, word-of-mouth-driven activity in most districts.

---

## 6. Go-to-Market Plan

**Phase 0 (Weeks 1–4): Pilot in your own backyard.**
Bellevue HICAP applications close in early October; winter testing runs into the following spring. Recruit 20–30 pilot families for free or heavily discounted access in exchange for feedback — through the Bellevue advanced-learning parent networks, PTA channels, and, opportunistically, the Local Bigger Burger customer base. Goal: validate the 10-week program actually gets finished, catch usability issues, collect testimonials.

**Phase 1 (Months 2–4): Paid launch in 2–3 districts.**
Expand beyond Bellevue to 1–2 other CogAT/HICAP districts (Seattle-area first for logistical ease, e.g. Lake Washington, Mercer Island, Issaquah — all run similar advanced-learning screening). Paid ads are low-priority here; local parent Facebook groups, subreddits, and word of mouth convert far better than generic search ads for this audience. Content marketing (a genuinely useful blog/guide — "CogAT testing dates by district," "what is HICAP," etc.) captures organic search traffic from anxious parents searching those exact terms.

**Phase 2 (Months 4–9): B2B — tutoring centers and districts.**
This is where LunchPad's existing playbook is directly reusable: you already know how to sell a SaaS product into a school-adjacent buyer (administrators, PTAs, or center owners) rather than a consumer. Package the license tier, and approach a handful of independent test-prep tutoring centers (not the big national chains initially — they're harder to move and more price-sensitive) with a white-label or co-branded offer.

**Phase 3 (Months 9+): Geographic and grade expansion.**
Add other CogAT levels (the content structure already supports this — each level is just a new tier of 9 subtest pools) to cover K–8, and expand district coverage nationally, prioritizing districts with active, well-organized parent gifted-ed communities (a good proxy for prep willingness-to-pay).

---

## 7. Legal, Compliance & Trust — Must-Fix List

This is the section most business plans for a consumer app skip, and it's the one that matters most here because **the customer is a minor's data.**

1. **COPPA compliance.** The product collects data from children under 13. Once this is a paid, commercial product (not a private family tool), COPPA's verified-parental-consent and data-handling requirements apply. This needs a real privacy policy, a real consent flow, and a data architecture that doesn't put one family's data in a bucket visible to any other family who has the link — which is how the current prototype works. This is not optional and should be treated as a launch blocker, not a post-launch cleanup item.
2. **Trademark care around "CogAT."** CogAT is a registered trademark of Riverside Insights. The product should market itself as independent, unofficial practice material ("not affiliated with or endorsed by Riverside Insights") everywhere the name appears, avoid using their logo or exact branding, and lean on descriptive language ("cognitive abilities test prep") in places where trademark risk is higher (ad copy, app store listings).
3. **FERPA, if selling to districts.** Any B2B motion that touches actual district data (not just parent-purchased consumer access) needs a FERPA-compliant data agreement. Consumer-side (parents buying directly) is a much lower bar than a district-side integration.
4. **Real backend + auth.** Needed regardless of compliance — a paid product needs real accounts, a real database, and payment processing (Stripe is the standard choice), replacing the current shared-storage prototype.
5. **Business entity.** You already operate F5H LLC for software development — this product fits naturally under that existing entity rather than needing a new one, which saves setup time and cost. Worth a short conversation with an accountant or lawyer about whether to run it as a new line of business under F5H or spin out a separate entity once revenue is real (liability separation becomes more relevant once you're handling other people's children's data and payments).

---

## 8. Product Roadmap to Get "Monetization-Ready"

Rough sequencing, not a committed timeline:

1. **Real accounts + backend.** Replace shared local/cloud storage with actual user auth and a real database (Supabase or Firebase are both fast paths for a small team; you already have the technical background to build this directly).
2. **Payments.** Stripe Checkout for one-time seasonal passes; Stripe Billing if the annual auto-renew tier is offered.
3. **Content expansion beyond Level 13.** Each additional CogAT level is a bounded, repeatable content-production task using the same pipeline already built for Level 13 — this is the most direct lever for expanding total addressable market.
4. **Parent-facing polish.** A proper onboarding flow, a real privacy policy and terms of service, and a cleaner "why this works" landing page aimed at a parent who's never seen the product before (today's UI assumes the person opening it already knows what it is).
5. **Basic analytics** for you: signup → paid conversion, program completion rate, and mock-test completion rate are the three numbers that matter most for iterating pricing and messaging.

---

## 9. Competitive Landscape (directional)

| Competitor type | Examples | Price point | Weakness this product exploits |
|---|---|---|---|
| Static PDF/workbook sellers | Etsy/TPT sellers, various gifted-test workbooks | $10–40 one-time | No adaptivity, no progress tracking, no pacing |
| Subscription test-prep sites | TestingMom.com and similar | ~$25–50/month | Broad/generic across many tests, not built around a specific 10-week program, subscription fatigue after the test |
| Private tutors | Local tutors, learning centers | $75–150/hour | Expensive, doesn't scale across siblings, inconsistent |
| Free resources | Sample PDFs from district sites, forum-shared worksheets | Free | No structure, no adaptivity, easy to exhaust |

The wedge is the combination of **structure** (the 10-week program), **genuine content depth** (540 randomly-sampled questions vs. a fixed worksheet), and **family economics** (one price covers every kid in the house) — none of the current options do all three.

---

## 10. Illustrative Financial Model

These are planning assumptions, not projections — treat them as a model to stress-test, not a forecast to bank on.

**Assumptions:**
- Average revenue per paying family: ~$70 (blended across Individual/Family passes)
- Pilot-to-paid conversion in a well-targeted local launch: 10–20% of engaged free users
- Cost per paying family via organic/community channels (Phase 0–1): near $0 in cash, real in founder time
- Gross margin: very high (>90%) once backend/hosting costs are fixed, since content is a one-time production cost

**Rough scenario — single-district pilot, Bellevue only, first season:**

| Metric | Conservative | Base case |
|---|---|---|
| Families reached (community channels) | 150 | 400 |
| Paid conversion rate | 10% | 15% |
| Paying families | 15 | 60 |
| Revenue (avg $70/family) | ~$1,050 | ~$4,200 |

This is intentionally small — the point of Phase 0–1 isn't revenue, it's proving conversion and completion rates that justify Phase 2 (B2B), where the real revenue scale shows up (a single tutoring-center or district license can be worth more than dozens of individual family passes).

---

## 11. Key Risks

- **Seasonality concentrates revenue** into a few months a year per district; the annual multi-year Family Pass and geographic/grade expansion are the main levers to smooth this.
- **Data privacy is the single biggest existential risk** given the product serves children — this has to be fixed architecturally before any paid launch, not treated as a nice-to-have.
- **Trademark exposure** around "CogAT" branding needs a clean disclaimer strategy from day one.
- **Retention is naturally low** per family per year (most families aren't testing every year) — the business model has to lean into referral and multi-child/multi-year value rather than assuming recurring engagement from any one household.
- **District receptivity varies** — some districts are neutral-to-friendly toward prep resources, others actively discourage it; district-by-district diligence is needed before any B2B push, not a blanket assumption that districts want to partner.

---

## 12. Immediate Next Steps

1. Fix the data architecture (real accounts, real backend) — this gates everything else.
2. Run the free Bellevue pilot (Phase 0) this testing season to validate completion rates and collect testimonials before charging anyone money.
3. Draft the privacy policy, ToS, and trademark-safe messaging in parallel with the pilot, not after.
4. Stand up Stripe and the seasonal-pass pricing once the pilot data supports it.
5. Revisit this plan after the first paid season with real conversion numbers — everything in Section 10 should be replaced with actuals.
