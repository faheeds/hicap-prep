// Payments & paywall (Epic 3, E3-1 through E3-4).
//
// Tests the entitlement gate logic and paywall UI. The actual Stripe API
// calls (checkout session creation, webhook delivery) require real test-mode
// keys and cannot run in jsdom — those are tested manually once the keys are
// configured (see .env.example).

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const HTML_PATH = new URL("../src/app.html", import.meta.url);

let dom, window;

async function boot() {
  const html = readFileSync(HTML_PATH, "utf-8");
  dom = new JSDOM(html, {
    runScripts: "dangerously", resources: "usable", pretendToBeVisual: true,
    url: HTML_PATH.href,
  });
  window = dom.window;
  window.alert = () => { throw new Error("native alert blocked"); };
  window.confirm = () => { throw new Error("native confirm blocked"); };
  window.prompt = () => { throw new Error("native prompt blocked"); };
  await new Promise((r) => setTimeout(r, 300));
}

function addStudent(name) {
  window.S.mode = "student"; window.S.view = "roster";
  window.S.addingStudent = true; window.render();
  window.document.getElementById("newName").value = name;
  window.submitNewStudent();
  return window.CUR;
}

before(async () => { await boot(); });
after(() => dom.window.close());

// --- isEntitled() -----------------------------------------------------------

test("isEntitled: free tier is not entitled", () => {
  window.APP.passType = "free";
  const sid = addStudent("Free Kid");
  assert.equal(window.isEntitled(sid), false);
});

test("isEntitled: family pass entitles all students", () => {
  window.APP.passType = "family";
  window.APP.passExpiresAt = new Date(Date.now() + 86400_000).toISOString(); // tomorrow
  const sid = addStudent("Family Kid");
  assert.equal(window.isEntitled(sid), true);
});

test("isEntitled: individual pass entitles only the named student", () => {
  window.APP.passType = "individual";
  window.APP.passExpiresAt = new Date(Date.now() + 86400_000).toISOString();
  const entitledId = addStudent("Entitled Kid");
  window.APP.passStudentId = entitledId;
  const otherSid = addStudent("Other Kid");
  assert.equal(window.isEntitled(entitledId), true, "named student should be entitled");
  assert.equal(window.isEntitled(otherSid), false, "other students should NOT be entitled");
});

test("isEntitled: expired pass is not entitled even if pass_type is set", () => {
  window.APP.passType = "family";
  window.APP.passExpiresAt = new Date(Date.now() - 86400_000).toISOString(); // yesterday
  const sid = addStudent("Expired Kid");
  assert.equal(window.isEntitled(sid), false);
  // Reset
  window.APP.passExpiresAt = null;
  window.APP.passType = "free";
});

test("isEntitled: family_annual pass entitles all students", () => {
  window.APP.passType = "family_annual";
  window.APP.passExpiresAt = new Date(Date.now() + 86400_000).toISOString();
  const sid = addStudent("Annual Kid");
  assert.equal(window.isEntitled(sid), true);
});

// --- freePracticeCountToday() -----------------------------------------------

test("freePracticeCountToday: zero for a brand-new student", () => {
  const sid = addStudent("Brand New");
  assert.equal(window.freePracticeCountToday(sid), 0);
});

test("freePracticeCountToday: counts only practice kind from today in local time", () => {
  const sid = addStudent("Counter Kid");
  const st = window.APP.students[sid];
  const today = window.localDateISO();
  st.history.unshift({ kind: "practice", date: today + "T10:00:00.000Z", title: "t", correct: 1, total: 1, bySub: {} });
  st.history.unshift({ kind: "program",  date: today + "T11:00:00.000Z", title: "t", correct: 1, total: 1, bySub: {} });
  assert.equal(window.freePracticeCountToday(sid), 1, "only practice kind should count");
  // Reset
  st.history = [];
});

// --- Paywall UI -----------------------------------------------------------

test("showPaywall sets MODAL.mode to paywall", () => {
  window.showPaywall("program");
  assert.equal(window.MODAL && window.MODAL.mode, "paywall");
  assert.equal(window.MODAL.context, "program");
  window.closeModal();
});

test("paywallModalHTML renders all three pass options", () => {
  window.showPaywall("program");
  const html = window.paywallModalHTML();
  assert.ok(html.includes("$49"), "should show individual pass price");
  assert.ok(html.includes("$79"), "should show family pass price");
  assert.ok(html.includes("$129"), "should show annual pass price");
  assert.ok(html.includes("startCheckout"), "should wire up startCheckout");
  window.closeModal();
});

test("paywallModalHTML shows correct headline per context", () => {
  window.showPaywall("mock");
  assert.ok(window.paywallModalHTML().includes("Mock tests"), "mock context");
  window.showPaywall("practice");
  assert.ok(window.paywallModalHTML().includes("today's free practice"), "practice context");
  window.closeModal();
});

// --- Gate: launchProgramDay blocks free users --------------------------------

test("launchProgramDay shows paywall for non-entitled student", () => {
  window.APP.passType = "free";
  const sid = addStudent("Free Program Kid");
  window.CUR = sid;
  window.closeModal();
  window.launchProgramDay(1, "mon");
  assert.equal(window.MODAL && window.MODAL.mode, "paywall", "should show paywall");
  assert.ok(!window.S.runner, "runner should not have started");
  window.closeModal();
});

test("launchProgramDay proceeds for an entitled student", () => {
  window.APP.passType = "family";
  window.APP.passExpiresAt = new Date(Date.now() + 86400_000).toISOString();
  const sid = addStudent("Paid Program Kid");
  window.CUR = sid;
  window.closeModal();
  window.launchProgramDay(1, "mon");
  assert.equal(window.MODAL, null, "should not show paywall");
  assert.ok(window.S.runner, "runner should have started");
  window.cancelRunner();
  window.APP.passType = "free"; window.APP.passExpiresAt = null;
});

// --- Gate: free-tier daily practice limit -----------------------------------

test("launchPracticeOne blocks after 1 free practice today", () => {
  window.APP.passType = "free";
  const sid = addStudent("One Practice Kid");
  window.CUR = sid;
  const st = window.APP.students[sid];
  const today = window.localDateISO();
  // Pre-load one practice for today.
  st.history.unshift({ kind: "practice", date: today + "T10:00:00.000Z", title: "t", correct: 1, total: 1, bySub: {} });

  window.S.b = "verbal"; window.S.t = 1; window.S.sub = "SC";
  window.closeModal();
  window.launchPracticeOne();
  assert.equal(window.MODAL && window.MODAL.mode, "paywall", "second practice should hit paywall");
  window.closeModal();
});

// --- Migration SQL ----------------------------------------------------------

test("migration 20260914000800 adds the expected columns", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/20260914000800_stripe_entitlements.sql", import.meta.url),
    "utf-8"
  );
  assert.ok(sql.includes("pass_type"), "must add pass_type");
  assert.ok(sql.includes("pass_expires_at"), "must add pass_expires_at");
  assert.ok(sql.includes("stripe_customer_id"), "must add stripe_customer_id");
  assert.ok(sql.includes("stripe_subscription_id"), "must add stripe_subscription_id");
});
