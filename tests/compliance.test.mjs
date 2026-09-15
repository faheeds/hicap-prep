// Epic 2 compliance surfaces. Each row lands more content in this file
// rather than a new tiny test suite per row.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { JSDOM } from "jsdom";

const APP_PATH = new URL("../src/app.html", import.meta.url);
const PRIVACY_PATH = new URL("../src/privacy.html", import.meta.url);
const TERMS_PATH = new URL("../src/terms.html", import.meta.url);
const LANDING_PATH = new URL("../src/landing.html", import.meta.url);

let dom, window, doc;

async function boot() {
  const html = readFileSync(APP_PATH, "utf-8");
  dom = new JSDOM(html, {
    runScripts: "dangerously", resources: "usable", pretendToBeVisual: true,
    url: APP_PATH.href,
  });
  window = dom.window;
  window.alert = () => { throw new Error("native alert blocked"); };
  window.confirm = () => { throw new Error("native confirm blocked"); };
  window.prompt = () => { throw new Error("native prompt blocked"); };
  await new Promise((r) => setTimeout(r, 300));
  doc = window.document;
}

before(boot);
after(() => dom.window.close());

test("E2-1: src/privacy.html exists and covers the required specifics", () => {
  assert.ok(existsSync(PRIVACY_PATH), "src/privacy.html should exist");
  const html = readFileSync(PRIVACY_PATH, "utf-8");
  // The acceptance criterion in the backlog: "what's collected (child's
  // first name, avatar, quiz history), why, who can see it, how to
  // delete it." Fail loudly if any of those sections goes missing.
  for (const needle of ["first name", "avatar", "quiz history", "Delete", "Export", "COPPA"]) {
    assert.match(html, new RegExp(needle, "i"), `privacy policy is missing a "${needle}" mention`);
  }
});

test("E2-1: app footer links to the privacy policy and includes the trademark disclaimer", () => {
  const footer = doc.querySelector("footer.legal");
  assert.ok(footer, "expected a footer.legal element on every rendered page");
  const html = footer.innerHTML;
  assert.match(html, /href="privacy\.html"/i, "footer must link to privacy.html");
  assert.match(html, /not affiliated with.*Riverside Insights/i,
    "footer must carry the 'not affiliated' disclaimer");
  assert.match(html, /CogAT/, "disclaimer should name CogAT explicitly");
});

test("E2-3: src/terms.html exists and covers seasonal pass / refund / no-guarantee-of-outcomes", () => {
  assert.ok(existsSync(TERMS_PATH), "src/terms.html should exist");
  const html = readFileSync(TERMS_PATH, "utf-8");
  // Backlog acceptance: "seasonal pass terms, refund policy, no
  // guarantee of test outcomes." Fail loudly if any goes missing.
  assert.match(html, /Family Pass|Individual Pass/, "must describe the pass structure");
  assert.match(html, /refund/i, "must state a refund policy");
  assert.match(html, /(no guarantee|does not guarantee)/i, "must disclaim outcome guarantees");
  assert.match(html, /not affiliated with[\s\S]*?Riverside/i, "must carry the trademark disclaimer");
});

test("E2-3: app footer also links to Terms of Service", () => {
  const footer = doc.querySelector("footer.legal");
  const html = footer.innerHTML;
  assert.match(html, /href="terms\.html"/i, "footer must link to terms.html");
});

test("E2-4: the 'not affiliated' disclaimer is present on every public surface", () => {
  // Every public-facing file that mentions CogAT should also carry the
  // disclaimer, since the two together form the trademark-safe nominative-use
  // pattern. If someone adds a new such surface later, they should add the
  // disclaimer at the same time — this test catches the omission.
  const disclaimer = /not affiliated with[\s\S]*?Riverside/i;
  const filesRequiringDisclaimer = [
    new URL("../src/app.html", import.meta.url),
    new URL("../src/privacy.html", import.meta.url),
    new URL("../src/terms.html", import.meta.url),
    new URL("../src/landing.html", import.meta.url),
    new URL("../README.md", import.meta.url),
  ];
  for (const f of filesRequiringDisclaimer) {
    const body = readFileSync(f, "utf-8");
    assert.match(body, disclaimer, `${f.pathname} mentions CogAT but is missing the disclaimer`);
  }
});

test("E4-1: src/landing.html exists, matches the design system, and links to the sign-up flow", () => {
  assert.ok(existsSync(LANDING_PATH), "src/landing.html should exist");
  const html = readFileSync(LANDING_PATH, "utf-8");

  // Design-system compliance: uses the same tokens as src/app.html.
  assert.match(html, /--flare:#f2621f/, "must define --flare per design system");
  assert.match(html, /--font-heading:"Cormorant Garamond"/, "must use Cormorant Garamond heading font");
  assert.match(html, /--font-body:"Lora"/, "must use Lora body font");
  assert.match(html, /class="app-header"/, "must reuse the app-header shell");
  assert.match(html, /class="wordmark">HiCap Prep/, "must show the HiCap Prep wordmark");

  // Copy blocks the row's acceptance criteria calls out.
  assert.match(html, /Ten weeks\. One kid at a time, or the whole house\./);
  assert.match(html, /Why we built it/);
  assert.match(html, /Four things it does that a workbook can't/);
  assert.match(html, /Get started free/);

  // Primary + closing CTA both link to the app's sign-up flow.
  const ctaLinks = html.match(/href="app\.html#signup"/g) || [];
  assert.ok(ctaLinks.length >= 2, `expected 2+ CTA links to app.html#signup, saw ${ctaLinks.length}`);

  // Epic 3 (payments) hasn't shipped — the landing must not name a price
  // or list a pricing plan yet, per the row's constraint.
  assert.doesNotMatch(html, /\$\d/, "no dollar prices while Epic 3 is unshipped");
  assert.doesNotMatch(html, /\b(monthly|annual|per month|per year|billed)\b/i, "no billing language yet");
});

test("E4-1: app.html#signup deep-link opens the auth gate in sign-up mode", () => {
  // Read the app.html source and confirm the AUTH_UI initial state is
  // wired to the hash. Full round-trip through jsdom would need a fake
  // Supabase (auth gate only appears in cloud mode); the source check is
  // the tight guarantee that matches this handler's job.
  const src = readFileSync(APP_PATH, "utf-8");
  assert.match(src, /let AUTH_UI = \{mode:\s*\(typeof location[^)]*location\.hash === "#signup"\)\s*\?\s*"signup"\s*:\s*"signin"/,
    "AUTH_UI initial mode must read location.hash === '#signup' so the landing-page CTA lands on the sign-up form");
});
