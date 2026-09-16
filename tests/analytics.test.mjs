// E6-3 / E2-6: Analytics (Plausible) + cookie/analytics consent banner tests.
//
// Verifies:
//   1. The consent helper functions are exposed on window and work correctly.
//   2. The banner renders when no prior consent is stored and is absent once
//      a decision is made.
//   3. trackEvent() is a no-op before consent is accepted.
//   4. The landing page carries the consent banner markup.
//   5. The analytics script is not loaded until consent is given.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const HTML_PATH    = new URL("../src/app.html",     import.meta.url);
const LANDING_PATH = new URL("../src/landing.html", import.meta.url);

let dom, window;

before(async () => {
  const html = readFileSync(HTML_PATH, "utf-8");
  dom = new JSDOM(html, {
    runScripts: "dangerously", resources: "usable", pretendToBeVisual: true,
    url: HTML_PATH.href,
  });
  window = dom.window;
  window.alert = () => {};
  window.confirm = () => {};
  window.prompt = () => {};

  // jsdom with a file:// URL has an opaque origin so localStorage throws.
  // Provide an in-memory mock so the analytics consent functions work as they
  // would in a real browser.
  const _store = {};
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem:    (k)    => Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null,
      setItem:    (k, v) => { _store[k] = String(v); },
      removeItem: (k)    => { delete _store[k]; },
      clear:      ()     => { Object.keys(_store).forEach(k => delete _store[k]); },
    },
    writable: true, configurable: true,
  });

  await new Promise((r) => setTimeout(r, 300));
  if(window.APP) window.APP.passType = "family";
});

after(() => dom.window.close());

// ---------------------------------------------------------------------------
// Helper functions exported on window
// ---------------------------------------------------------------------------

test("analyticsConsent() is exposed on window", () => {
  assert.ok(typeof window.analyticsConsent === "function",
    "analyticsConsent must be exposed on window");
});

test("shouldShowAnalyticsBanner() returns true when no consent stored", () => {
  // localStorage is fresh in jsdom — no prior consent.
  window.localStorage.removeItem("hicap-analytics");
  assert.equal(window.shouldShowAnalyticsBanner(), true,
    "banner must be shown when consent has not been given");
});

test("shouldShowAnalyticsBanner() returns false after accept", () => {
  window.localStorage.removeItem("hicap-analytics");
  window.acceptAnalytics();
  assert.equal(window.shouldShowAnalyticsBanner(), false,
    "banner must not show after acceptance");
  window.localStorage.removeItem("hicap-analytics");
});

test("shouldShowAnalyticsBanner() returns false after decline", () => {
  window.localStorage.removeItem("hicap-analytics");
  window.declineAnalytics();
  assert.equal(window.shouldShowAnalyticsBanner(), false,
    "banner must not show after decline");
  window.localStorage.removeItem("hicap-analytics");
});

test("analyticsConsent() reflects localStorage state correctly", () => {
  window.localStorage.removeItem("hicap-analytics");
  assert.equal(window.analyticsConsent(), null, "no prior consent → null");

  window.acceptAnalytics();
  assert.equal(window.analyticsConsent(), "accepted");

  window.localStorage.removeItem("hicap-analytics");
  window.declineAnalytics();
  assert.equal(window.analyticsConsent(), "declined");

  window.localStorage.removeItem("hicap-analytics");
});

// ---------------------------------------------------------------------------
// Banner HTML
// ---------------------------------------------------------------------------

test("analyticsBannerHTML() contains accept and decline buttons", () => {
  window.localStorage.removeItem("hicap-analytics");
  const html = window.analyticsBannerHTML();
  assert.ok(html.includes("acceptAnalytics"), "must call acceptAnalytics() on accept");
  assert.ok(html.includes("declineAnalytics"), "must call declineAnalytics() on decline");
  assert.ok(html.includes("That's fine"), "accept button must read 'That's fine'");
  assert.ok(html.includes("No thanks"), "decline button must read 'No thanks'");
});

test("analyticsBannerHTML() mentions Plausible as the analytics provider", () => {
  window.localStorage.removeItem("hicap-analytics");
  const html = window.analyticsBannerHTML();
  assert.ok(html.toLowerCase().includes("plausible"),
    "consent disclosure must name the analytics provider");
});

test("analyticsBannerHTML() returns empty string when consent is already stored", () => {
  window.localStorage.setItem("hicap-analytics", "accepted");
  assert.equal(window.analyticsBannerHTML(), "",
    "banner HTML must be empty when consent is already recorded");
  window.localStorage.removeItem("hicap-analytics");
});

// ---------------------------------------------------------------------------
// trackEvent() — no-op before consent
// ---------------------------------------------------------------------------

test("trackEvent() does nothing when consent is null (not yet asked)", () => {
  window.localStorage.removeItem("hicap-analytics");
  // Spy: if plausible() were called, this would throw — proves it wasn't.
  window.plausible = () => { throw new Error("plausible() must not fire before consent"); };
  assert.doesNotThrow(() => window.trackEvent("Test Event"),
    "trackEvent must be a no-op when no consent is stored");
  delete window.plausible;
});

test("trackEvent() does nothing when consent is declined", () => {
  window.localStorage.setItem("hicap-analytics", "declined");
  window.plausible = () => { throw new Error("plausible() must not fire when declined"); };
  assert.doesNotThrow(() => window.trackEvent("Test Event"),
    "trackEvent must be a no-op when analytics is declined");
  delete window.plausible;
  window.localStorage.removeItem("hicap-analytics");
});

test("trackEvent() calls plausible() when consent is accepted", () => {
  window.localStorage.setItem("hicap-analytics", "accepted");
  let fired = null;
  window.plausible = (name, opts) => { fired = { name, opts }; };
  window.trackEvent("Practice Session", { battery: "verbal" });
  assert.equal(fired?.name, "Practice Session", "plausible() must be called with the event name");
  assert.deepEqual(fired?.opts?.props, { battery: "verbal" });
  delete window.plausible;
  window.localStorage.removeItem("hicap-analytics");
});

// ---------------------------------------------------------------------------
// Landing page carries consent banner markup
// ---------------------------------------------------------------------------

test("landing.html has analytics consent banner markup", () => {
  const src = readFileSync(LANDING_PATH, "utf-8");
  assert.ok(src.includes("analytics-banner"), "landing.html must include analytics banner");
  assert.ok(src.includes("analytics-accept"), "landing.html must include accept button");
  assert.ok(src.includes("analytics-decline"), "landing.html must include decline button");
  assert.ok(src.toLowerCase().includes("plausible"),
    "landing.html consent text must name Plausible");
});

test("landing.html consent banner sets localStorage on click", () => {
  const src = readFileSync(LANDING_PATH, "utf-8");
  assert.ok(src.includes(`hicap-analytics`),
    "landing.html must read/write the hicap-analytics localStorage key");
});

test("app.html analytics script is not injected unless plausibleDomain is configured", () => {
  // With no plausibleDomain in __HICAP_CONFIG, calling _loadPlausible (triggered
  // by acceptAnalytics) must not add any <script> to the document.
  window.localStorage.removeItem("hicap-analytics");
  window.__HICAP_CONFIG = { plausibleDomain: "" };
  window.acceptAnalytics();
  const scripts = Array.from(window.document.querySelectorAll("script[id='plausible-script']"));
  assert.equal(scripts.length, 0, "no Plausible script injected when domain is not configured");
  window.localStorage.removeItem("hicap-analytics");
});
