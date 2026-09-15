// Epic 2 compliance surfaces. Each row lands more content in this file
// rather than a new tiny test suite per row.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { JSDOM } from "jsdom";

const APP_PATH = new URL("../src/app.html", import.meta.url);
const PRIVACY_PATH = new URL("../src/privacy.html", import.meta.url);
const TERMS_PATH = new URL("../src/terms.html", import.meta.url);

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
    new URL("../README.md", import.meta.url),
  ];
  for (const f of filesRequiringDisclaimer) {
    const body = readFileSync(f, "utf-8");
    assert.match(body, disclaimer, `${f.pathname} mentions CogAT but is missing the disclaimer`);
  }
});
