// E5-0: DRILLS level-dimension refactor.
//
// Verifies that DRILLS is keyed [level][battery][tier][subtest], that the
// grade→CogAT-level mapping is correct, that all sampling functions accept
// and honour the level argument, and that effectiveLevel() falls back to 13
// when a requested level has no content bank yet — loudly, not silently.

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
  window.alert = () => {};
  window.confirm = () => {};
  window.prompt = () => {};
  await new Promise((r) => setTimeout(r, 300));
  // Grant a family pass so entitlement gates don't block question-sampling tests.
  if (window.APP) window.APP.passType = "family";
}

before(async () => { await boot(); });
after(() => dom.window.close());

// Build a minimal but distinguishable stub bank for a synthetic level.
// Each question's stem is "stub-lvlN-battery-tT-sub-qK" so tests can assert
// the right pool was served — not just that *some* questions came back.
function makeStubBank(level) {
  const subs = {
    verbal:    ["SC", "VC", "VA"],
    quant:     ["NS", "NP", "NA"],
    nonverbal: ["FC", "FM", "PF"],
  };
  const bank = {};
  for (const [bat, subtests] of Object.entries(subs)) {
    bank[bat] = {};
    for (const tier of [1, 2, 3]) {
      bank[bat][tier] = {};
      for (const sub of subtests) {
        bank[bat][tier][sub] = Array.from({ length: 10 }, (_, i) => ({
          q: `stub-lvl${level}-${bat}-t${tier}-${sub}-q${i + 1}`,
          o: ["alpha", "beta", "gamma", "delta"],
          a: 0,
          e: `stub explanation for level ${level}`,
        }));
      }
    }
  }
  return bank;
}

// ---------------------------------------------------------------------------
// DRILLS structure: outer key is CogAT level
// ---------------------------------------------------------------------------

test("DRILLS top-level keys are CogAT level numbers (not battery names)", () => {
  const keys = Object.keys(window.DRILLS);
  assert.ok(keys.length > 0, "DRILLS must not be empty");
  for (const k of keys) {
    assert.ok(!isNaN(Number(k)), `DRILLS key "${k}" must be a numeric level, not a battery name`);
    assert.ok(Number(k) >= 8 && Number(k) <= 17, `Level ${k} is outside the expected CogAT range 8-17`);
  }
  assert.ok(window.DRILLS[13], "DRILLS must have a key for Level 13 (grade 7)");
});

test("DRILLS[13] contains all three batteries with all three tiers and all subtests", () => {
  const d = window.DRILLS[13];
  for (const battery of ["verbal", "quant", "nonverbal"]) {
    assert.ok(d[battery], `battery ${battery} missing from DRILLS[13]`);
    for (const tier of [1, 2, 3]) {
      assert.ok(d[battery][tier], `tier ${tier} missing from DRILLS[13][${battery}]`);
    }
  }
  assert.ok(Array.isArray(d.verbal[1].SC),     "DRILLS[13].verbal[1].SC must be an array");
  assert.ok(Array.isArray(d.quant[1].NS),       "DRILLS[13].quant[1].NS must be an array");
  assert.ok(Array.isArray(d.nonverbal[1].FC),   "DRILLS[13].nonverbal[1].FC must be an array");
});

// ---------------------------------------------------------------------------
// Grade → CogAT level mapping
// ---------------------------------------------------------------------------

test("GRADE_TO_LEVEL maps every supported grade to the correct CogAT level", () => {
  const expected = { 1: 8, 3: 9, 4: 10, 5: 11, 6: 12, 7: 13, 8: 14, 9: 15, 10: 16, 11: 17 };
  const map = window.GRADE_TO_LEVEL;
  assert.ok(map, "GRADE_TO_LEVEL must be exposed on window");
  for (const [grade, level] of Object.entries(expected)) {
    assert.equal(map[grade], level, `grade ${grade} should map to level ${level}`);
  }
});

test("gradeToLevel(7) returns 13, gradeToLevel(6) returns 12", () => {
  assert.equal(window.gradeToLevel(7), 13);
  assert.equal(window.gradeToLevel(6), 12);
  assert.equal(window.gradeToLevel(3), 9);
  assert.equal(window.gradeToLevel(11), 17);
});

test("addStudent stores grade and cogatLevel on the student record", () => {
  window.S.mode = "student"; window.S.view = "roster";
  window.S.addingStudent = true; window.render();
  window.document.getElementById("newName").value = "Level Test Kid";
  window.submitNewStudent(); // S.newGrade defaults to 7
  const st = window.APP.students[window.CUR];
  assert.equal(st.grade, 7, "default grade must be 7");
  assert.equal(st.cogatLevel, 13, "grade 7 must produce cogatLevel 13");
});

// ---------------------------------------------------------------------------
// sampleQuestions / collectQuestions — level argument is honoured
// ---------------------------------------------------------------------------

test("sampleQuestions(13, ...) returns questions from DRILLS[13]", () => {
  const qs = window.sampleQuestions(13, "verbal", 1, "SC", 5);
  assert.equal(qs.length, 5);
  assert.ok(qs[0].q, "question must have a stem");
  assert.ok(qs[0]._sub === "SC", "tagList must tag each question with its subtest");
});

test("collectQuestions(13, battery, tier, 'ALL', n) returns n questions per subtest", () => {
  const qs = window.collectQuestions(13, "verbal", 1, "ALL", 10);
  assert.equal(qs.length, 30, "ALL pull across 3 verbal subtests must be 30 questions");
});

test("weekPlan embeds plan.level from the student's cogatLevel", () => {
  window.S.mode = "student"; window.S.view = "roster";
  window.S.addingStudent = true; window.render();
  window.document.getElementById("newName").value = "Week Plan Kid";
  window.submitNewStudent();
  const st = window.APP.students[window.CUR];
  const plan = window.weekPlan(1, st);
  assert.equal(plan.level, 13, "weekPlan must set plan.level to student.cogatLevel");
  assert.ok(plan.mon, "plan must have a mon entry");
  assert.ok(plan.fri, "plan must have a fri entry");
});

// ---------------------------------------------------------------------------
// Positive-path: stub a second level (99) and confirm routing goes to it
//
// Purpose: the 12 original tests only prove the fallback (when a level is
// missing). This group proves the non-fallback, multi-level routing end to
// end — the only way to exercise that path without authoring a full second
// grade's content bank.
// ---------------------------------------------------------------------------

test("sampleQuestions routes to a newly added stub level — not to the fallback", () => {
  window.DRILLS[99] = makeStubBank(99);
  try {
    const qs = window.sampleQuestions(99, "verbal", 1, "SC", 5);
    assert.equal(qs.length, 5);
    // Every returned question must carry the stub marker for level 99.
    for (const q of qs) {
      assert.ok(
        q.q.startsWith("stub-lvl99-"),
        `question stem "${q.q}" must come from the level-99 stub, not the level-13 fallback`
      );
    }
    // Sanity: a level-13 question would NOT start with stub-lvl99
    const l13 = window.sampleQuestions(13, "verbal", 1, "SC", 1);
    assert.ok(
      !l13[0].q.startsWith("stub-lvl99-"),
      "level-13 questions must not come from the level-99 stub"
    );
  } finally {
    delete window.DRILLS[99];
  }
});

test("collectQuestions routes ALL subtests through the stub level correctly", () => {
  window.DRILLS[99] = makeStubBank(99);
  try {
    const qs = window.collectQuestions(99, "verbal", 1, "ALL", 5);
    // 3 verbal subtests × 5 each = 15 questions, all from the stub
    assert.equal(qs.length, 15, "ALL across 3 verbal subtests of level 99 stub must yield 15");
    for (const q of qs) {
      assert.ok(
        q.q.startsWith("stub-lvl99-verbal-"),
        `"${q.q}" must be from the level-99 verbal stub`
      );
    }
  } finally {
    delete window.DRILLS[99];
  }
});

test("effectiveLevel(99) returns 99 when the stub bank is present", () => {
  window.DRILLS[99] = makeStubBank(99);
  try {
    assert.equal(window.effectiveLevel(99), 99,
      "effectiveLevel must return the real level when a bank exists for it");
  } finally {
    delete window.DRILLS[99];
  }
});

test("weekPlan.level routes a level-99 student to the stub bank via launchProgramDay", () => {
  // Add a student with a synthetic cogatLevel and confirm the program day
  // draws from the stub, not from level 13.
  window.DRILLS[99] = makeStubBank(99);
  try {
    window.S.mode = "student"; window.S.view = "roster";
    window.S.addingStudent = true; window.render();
    window.document.getElementById("newName").value = "Stub99 Kid";
    window.submitNewStudent();
    const sid = window.CUR;
    // Override cogatLevel to 99 directly (no GRADE_TO_LEVEL entry — that's OK,
    // it tests that the routing key is cogatLevel, not grade).
    window.APP.students[sid].cogatLevel = 99;

    window.launchProgramDay(1, "mon"); // verbal battery, week 1 = tier 1
    const qs = window.S.runner.questions;
    assert.equal(qs.length, 30, "program day should draw 30 questions");
    const fromStub = qs.filter(q => q.q.startsWith("stub-lvl99-verbal-"));
    assert.equal(fromStub.length, 30,
      "all 30 questions must come from the level-99 stub, not from level-13");
    window.cancelRunner();
  } finally {
    delete window.DRILLS[99];
  }
});

// ---------------------------------------------------------------------------
// effectiveLevel() fallback — observable, not silent
// ---------------------------------------------------------------------------

test("effectiveLevel(13) returns 13 (bank exists, no warn)", () => {
  const warns = [];
  const orig = window.console.warn;
  window.console.warn = (...args) => warns.push(args.join(" "));
  try {
    assert.equal(window.effectiveLevel(13), 13);
    assert.equal(warns.length, 0, "effectiveLevel must NOT warn when the bank exists");
  } finally {
    window.console.warn = orig;
  }
});

test("effectiveLevel(12) falls back to 13 AND emits a console.warn", () => {
  const warns = [];
  const orig = window.console.warn;
  window.console.warn = (...args) => warns.push(args.join(" "));
  try {
    const result = window.effectiveLevel(12);
    assert.equal(result, 13, "must return 13 as the fallback level");
    assert.equal(warns.length, 1, "must emit exactly one warning");
    assert.ok(warns[0].includes("12"), "warning must mention the requested level");
    assert.ok(warns[0].includes("13"), "warning must mention the fallback level being served");
    assert.ok(warns[0].toLowerCase().includes("fallback") || warns[0].toLowerCase().includes("no content"),
      "warning text must make the situation clear");
  } finally {
    window.console.warn = orig;
  }
});

test("sampleQuestions with a missing level fires a warn and falls back gracefully", () => {
  const warns = [];
  const orig = window.console.warn;
  window.console.warn = (...args) => warns.push(args.join(" "));
  try {
    const qs = window.sampleQuestions(12, "verbal", 1, "SC", 5);
    assert.equal(qs.length, 5, "should still return 5 questions via fallback to level 13");
    assert.ok(warns.some(w => w.includes("12")),
      "at least one warning must reference level 12");
  } finally {
    window.console.warn = orig;
  }
});

test("per-battery fallback: Level 11 verbal serves real content (no warn); quant/nonverbal fall back to 13 (with warn)", () => {
  const warns = [];
  const orig = window.console.warn;
  window.console.warn = (...args) => warns.push(args.join(" "));
  try {
    // Verbal Tier 1 exists — must route to real Level-11 content with no warning.
    const verbal = window.sampleQuestions(11, "verbal", 1, "SC", 5);
    assert.equal(verbal.length, 5, "should return 5 Level-11 SC questions");
    assert.equal(warns.length, 0, "no warning when the battery IS authored for Level 11");

    // Quant Tier 1 is not authored for Level 11 — must warn and fall back.
    const quant = window.sampleQuestions(11, "quant", 1, "NS", 5);
    assert.equal(quant.length, 5, "should still return 5 questions via fallback");
    assert.equal(warns.length, 1, "exactly one warning for the missing quant bank");
    assert.ok(warns[0].includes("11"), "warning must mention Level 11");
    assert.ok(warns[0].includes("quant"), "warning must mention the missing battery");
    assert.ok(warns[0].includes("13"), "warning must mention Level 13 as the fallback");
    assert.ok(
      warns[0].toLowerCase().includes("fallback") || warns[0].toLowerCase().includes("serving level 13"),
      "warning text must make the situation clear"
    );
    // The actionable hint should tell the author what to add.
    assert.ok(warns[0].includes("DRILLS[11]"), "warning must include the DRILLS path to add");

    // Nonverbal Tier 1 is also absent — a second warning.
    const nonverbal = window.sampleQuestions(11, "nonverbal", 1, "FC", 5);
    assert.equal(nonverbal.length, 5, "should still return 5 questions via fallback");
    assert.equal(warns.length, 2, "second warning for the missing nonverbal bank");
    assert.ok(warns[1].includes("nonverbal"), "second warning must mention the missing battery");
  } finally {
    window.console.warn = orig;
  }
});

test("effectiveLevel(9999) falls back to 13 with a warning", () => {
  const warns = [];
  const orig = window.console.warn;
  window.console.warn = (...args) => warns.push(args.join(" "));
  try {
    assert.equal(window.effectiveLevel(9999), 13);
    assert.ok(warns.length > 0, "must warn for a completely invalid level");
    assert.ok(warns[0].includes("9999"), "warning must mention the invalid level");
  } finally {
    window.console.warn = orig;
  }
});

// ---------------------------------------------------------------------------
// Level 11 (Grade 5) verbal pilot — real content, not stub
// ---------------------------------------------------------------------------

test("effectiveLevel(11) returns 11 — bank now exists (no warn)", () => {
  const warns = [];
  const orig = window.console.warn;
  window.console.warn = (...args) => warns.push(args.join(" "));
  try {
    assert.equal(window.effectiveLevel(11), 11,
      "effectiveLevel must return 11 now that DRILLS[11] exists");
    assert.equal(warns.length, 0, "must NOT warn when the bank exists");
  } finally {
    window.console.warn = orig;
  }
});

test("sampleQuestions(11, verbal, 1, SC, 5) serves real Level-11 content", () => {
  const qs = window.sampleQuestions(11, "verbal", 1, "SC", 5);
  assert.equal(qs.length, 5);
  // Level-13 SC questions use vocabulary like "erudite"/"perfidious"; Level-11 SC
  // questions contain simpler stems (e.g. "puppy", "cookies"). The reliable check
  // is that none of the returned questions are from level-13 stems by verifying
  // the pool is distinct — easiest via the question stem text itself.
  // Every Level-11 SC stem ends with a blank ("___").
  for (const q of qs) {
    assert.ok(q.q.includes("___"), `Level-11 SC stem must contain a blank: "${q.q}"`);
    assert.ok(q._sub === "SC", "question must be tagged SC");
  }
});

test("sampleQuestions(11, verbal, 1, VC, 5) serves real Level-11 VC content", () => {
  const qs = window.sampleQuestions(11, "verbal", 1, "VC", 5);
  assert.equal(qs.length, 5);
  for (const q of qs) {
    assert.ok(q.q.includes("— which belongs?"), `Level-11 VC stem must follow the classification format: "${q.q}"`);
    assert.ok(q._sub === "VC", "question must be tagged VC");
  }
});

test("sampleQuestions(11, verbal, 1, VA, 5) serves real Level-11 VA content", () => {
  const qs = window.sampleQuestions(11, "verbal", 1, "VA", 5);
  assert.equal(qs.length, 5);
  for (const q of qs) {
    assert.ok(q.q.includes("is to") && q.q.includes("___?"),
      `Level-11 VA stem must follow analogy format: "${q.q}"`);
    assert.ok(q._sub === "VA", "question must be tagged VA");
  }
});

test("collectQuestions(11, verbal, 1, ALL, 10) returns 30 real Level-11 questions", () => {
  const qs = window.collectQuestions(11, "verbal", 1, "ALL", 10);
  assert.equal(qs.length, 30, "3 verbal subtests × 10 = 30");
  const sc = qs.filter(q => q._sub === "SC");
  const vc = qs.filter(q => q._sub === "VC");
  const va = qs.filter(q => q._sub === "VA");
  assert.equal(sc.length, 10, "10 SC questions");
  assert.equal(vc.length, 10, "10 VC questions");
  assert.equal(va.length, 10, "10 VA questions");
});
