// E5-0: DRILLS level-dimension refactor.
//
// Verifies that DRILLS is keyed [level][battery][tier][subtest], that the
// grade→CogAT-level mapping is correct, that all sampling functions accept
// and honour the level argument, and that effectiveLevel() falls back to 13
// when a requested level has no content bank yet.

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
  // Spot-check subtest presence
  assert.ok(Array.isArray(d.verbal[1].SC), "DRILLS[13].verbal[1].SC must be an array");
  assert.ok(Array.isArray(d.quant[1].NS),  "DRILLS[13].quant[1].NS must be an array");
  assert.ok(Array.isArray(d.nonverbal[1].FC), "DRILLS[13].nonverbal[1].FC must be an array");
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
  // Grade 7 → Level 13
  window.S.mode = "student"; window.S.view = "roster";
  window.S.addingStudent = true; window.render();
  window.document.getElementById("newName").value = "Level Test Kid";
  window.submitNewStudent(); // S.newGrade defaults to 7
  const sid = window.CUR;
  const st = window.APP.students[sid];
  assert.equal(st.grade, 7, "default grade must be 7");
  assert.equal(st.cogatLevel, 13, "grade 7 must produce cogatLevel 13");
});

// ---------------------------------------------------------------------------
// sampleQuestions / collectQuestions / collectMixedSpeed / collectMock
// now accept level as first argument
// ---------------------------------------------------------------------------

test("sampleQuestions(13, ...) returns questions from DRILLS[13]", () => {
  const qs = window.sampleQuestions(13, "verbal", 1, "SC", 5);
  assert.equal(qs.length, 5);
  assert.ok(qs[0].q, "question must have a stem");
  assert.ok(qs[0]._sub === "SC", "tagList must tag each question with its subtest");
});

test("collectQuestions(13, battery, tier, 'ALL', n) returns n questions per subtest", () => {
  const qs = window.collectQuestions(13, "verbal", 1, "ALL", 10);
  // verbal has 3 subtests × 10 = 30
  assert.equal(qs.length, 30, "ALL pull across 3 verbal subtests must be 30 questions");
});

test("weekPlan embeds plan.level from the student's cogatLevel", () => {
  window.S.mode = "student"; window.S.view = "roster";
  window.S.addingStudent = true; window.render();
  window.document.getElementById("newName").value = "Week Plan Kid";
  window.submitNewStudent();
  const sid = window.CUR;
  const st = window.APP.students[sid]; // grade 7, cogatLevel 13
  const plan = window.weekPlan(1, st);
  assert.equal(plan.level, 13, "weekPlan must set plan.level to student.cogatLevel");
  assert.ok(plan.mon, "plan must have a mon entry");
  assert.ok(plan.fri, "plan must have a fri entry");
});

// ---------------------------------------------------------------------------
// effectiveLevel() fallback
// ---------------------------------------------------------------------------

test("effectiveLevel(13) returns 13 (bank exists)", () => {
  assert.equal(window.effectiveLevel(13), 13);
});

test("effectiveLevel(11) falls back to 13 (no grade-5 bank yet)", () => {
  assert.equal(window.effectiveLevel(11), 13,
    "level 11 has no content bank yet — must fall back to 13");
});

test("effectiveLevel(9999) falls back to 13 (nonsense level)", () => {
  assert.equal(window.effectiveLevel(9999), 13);
});

test("sampleQuestions with a level without content falls back gracefully", () => {
  // grade 5 student (level 11) — no bank yet, must not throw
  const qs = window.sampleQuestions(11, "verbal", 1, "SC", 5);
  assert.equal(qs.length, 5, "should still return 5 questions via fallback to level 13");
});
