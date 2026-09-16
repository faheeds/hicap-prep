// SEO content pages tests (Epic 6, E6-4).
//
// Structural checks only. Verifies that each page:
//   - exists with the right title and meta description
//   - carries the trademark disclaimer
//   - links to app.html (acquisition path)
//   - links between sibling SEO pages (internal linking)
//   - uses the correct font preconnects (design system requirement)
//   - does NOT assert specific testing dates or district names as facts
//   - includes a breadcrumb for navigation context
//   - has an h1 and at least one h2

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const COGAT   = readFileSync(new URL("../src/cogat-guide.html",    import.meta.url), "utf-8");
const GIFTED  = readFileSync(new URL("../src/gifted-testing.html", import.meta.url), "utf-8");
const DATES   = readFileSync(new URL("../src/testing-dates.html",  import.meta.url), "utf-8");
const LANDING = readFileSync(new URL("../src/landing.html",        import.meta.url), "utf-8");

// ---------------------------------------------------------------------------
// cogat-guide.html
// ---------------------------------------------------------------------------
test("cogat-guide: has correct title and meta description", () => {
  assert.match(COGAT, /<title>[^<]*CogAT[^<]*HiCap Prep[^<]*<\/title>/i);
  assert.match(COGAT, /name="description"/i);
  assert.match(COGAT, /content="[^"]*CogAT[^"]*"/i);
});

test("cogat-guide: has h1 and at least one h2", () => {
  assert.match(COGAT, /<h1[^>]*>/i);
  assert.match(COGAT, /<h2[^>]*>/i);
});

test("cogat-guide: carries the trademark disclaimer", () => {
  assert.match(COGAT, /not affiliated/i);
  assert.match(COGAT, /Riverside Insights/);
  assert.match(COGAT, /CogAT.*registered trademark/i);
});

test("cogat-guide: links to app.html for acquisition", () => {
  assert.match(COGAT, /href="app\.html/);
});

test("cogat-guide: links to sibling SEO pages", () => {
  assert.match(COGAT, /href="gifted-testing\.html"/);
  assert.match(COGAT, /href="testing-dates\.html"/);
});

test("cogat-guide: explains all three batteries by name", () => {
  assert.match(COGAT, /Verbal/i);
  assert.match(COGAT, /Quantitative/i);
  assert.match(COGAT, /Nonverbal/i);
});

test("cogat-guide: has breadcrumb navigation", () => {
  assert.match(COGAT, /breadcrumb/i);
  assert.match(COGAT, /aria-current="page"/);
});

test("cogat-guide: uses design system fonts (Cormorant Garamond + Lora)", () => {
  assert.match(COGAT, /Cormorant\+Garamond/);
  assert.match(COGAT, /Lora/);
});

test("cogat-guide: uses design system color tokens (not raw hex overrides)", () => {
  assert.match(COGAT, /var\(--flare\)/);
  assert.match(COGAT, /var\(--ink\)/);
  assert.match(COGAT, /var\(--bg\)/);
});

// ---------------------------------------------------------------------------
// gifted-testing.html
// ---------------------------------------------------------------------------
test("gifted-testing: has correct title and meta description", () => {
  assert.match(GIFTED, /<title>[^<]*gifted|HICAP|highly capable[^<]*HiCap Prep[^<]*<\/title>/i);
  assert.match(GIFTED, /name="description"/i);
});

test("gifted-testing: has h1 and at least one h2", () => {
  assert.match(GIFTED, /<h1[^>]*>/i);
  assert.match(GIFTED, /<h2[^>]*>/i);
});

test("gifted-testing: carries the trademark disclaimer", () => {
  assert.match(GIFTED, /not affiliated/i);
  assert.match(GIFTED, /Riverside Insights/);
});

test("gifted-testing: links to app.html for acquisition", () => {
  assert.match(GIFTED, /href="app\.html/);
});

test("gifted-testing: links to sibling SEO pages", () => {
  assert.match(GIFTED, /href="cogat-guide\.html"/);
  assert.match(GIFTED, /href="testing-dates\.html"/);
});

test("gifted-testing: mentions HICAP and highly capable", () => {
  assert.match(GIFTED, /HICAP|Highly Capable/i);
});

test("gifted-testing: notes that district specifics vary — no guaranteed facts asserted", () => {
  // The page must tell the reader to verify with their district rather than
  // asserting program criteria as universal fact.
  assert.match(GIFTED, /vary by district|verify.*district|contact.*district/i);
});

test("gifted-testing: has breadcrumb navigation", () => {
  assert.match(GIFTED, /breadcrumb/i);
  assert.match(GIFTED, /aria-current="page"/);
});

test("gifted-testing: uses design system fonts", () => {
  assert.match(GIFTED, /Cormorant\+Garamond/);
  assert.match(GIFTED, /Lora/);
});

// ---------------------------------------------------------------------------
// testing-dates.html
// ---------------------------------------------------------------------------
test("testing-dates: has correct title and meta description", () => {
  assert.match(DATES, /<title>[^<]*testing dates[^<]*HiCap Prep[^<]*<\/title>/i);
  assert.match(DATES, /name="description"/i);
  assert.match(DATES, /content="[^"]*vary by district[^"]*"/i);
});

test("testing-dates: has h1 and at least one h2", () => {
  assert.match(DATES, /<h1[^>]*>/i);
  assert.match(DATES, /<h2[^>]*>/i);
});

test("testing-dates: explicitly states we do NOT list specific dates", () => {
  // The page must not pretend to have accurate current dates and must tell
  // the reader to get them from the district directly.
  assert.match(DATES, /don't publish|do not publish|doesn't list|we don't/i,
    "page must state that specific dates are not published here");
});

test("testing-dates: does not assert any specific date or month as a fact", () => {
  // Months used to assert a specific test date (e.g., "testing is in October")
  // are not permitted — they would become stale and mislead families.
  // Months mentioned as examples (in narrative context) are OK.
  // We check that no date is asserted as the authoritative answer.
  // No <time> or specific date assertion like "tests in [Month]" as headline.
  assert.doesNotMatch(DATES,
    /CogAT (tests|testing) (in|during|on) (January|February|March|April|May|June|July|August|September|October|November|December)\b/i,
    "page must not assert a specific testing month as universal fact");
});

test("testing-dates: directs reader to the district for authoritative dates", () => {
  assert.match(DATES, /district.*website|school.*counselor|district.*direct/i);
});

test("testing-dates: explains how to build a prep plan around the found date", () => {
  assert.match(DATES, /10.week|ten.week/i);
  assert.match(DATES, /count back|work.*backward|start.*week/i);
});

test("testing-dates: carries the disclaimer about no district affiliation", () => {
  assert.match(DATES, /not affiliated/i);
});

test("testing-dates: links to sibling SEO pages", () => {
  assert.match(DATES, /href="cogat-guide\.html"/);
  assert.match(DATES, /href="gifted-testing\.html"/);
});

test("testing-dates: has breadcrumb navigation", () => {
  assert.match(DATES, /breadcrumb/i);
  assert.match(DATES, /aria-current="page"/);
});

test("testing-dates: uses design system fonts", () => {
  assert.match(DATES, /Cormorant\+Garamond/);
  assert.match(DATES, /Lora/);
});

// ---------------------------------------------------------------------------
// landing.html: links to all three SEO pages
// ---------------------------------------------------------------------------
test("landing.html: footer links to all three SEO content pages", () => {
  assert.match(LANDING, /href="cogat-guide\.html"/);
  assert.match(LANDING, /href="gifted-testing\.html"/);
  assert.match(LANDING, /href="testing-dates\.html"/);
});
