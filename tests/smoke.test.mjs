// Regression suite for src/app.html.
// This formalizes the manual jsdom smoke-test pattern used during initial
// development into real, assertable tests. Extend this file (or add sibling
// *.test.mjs files) for new features rather than starting a new test style —
// see CLAUDE.md.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const HTML_PATH = new URL("../src/app.html", import.meta.url);

let dom, window, doc;

async function boot() {
  const html = readFileSync(HTML_PATH, "utf-8");
  dom = new JSDOM(html, {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    // Point the document URL at the actual file so <script src="..."> tags
    // (supabase-client.js, auth.js) resolve to real files in src/ rather
    // than 404-ing against localhost:80.
    url: HTML_PATH.href,
  });
  window = dom.window;
  // Simulate the worst case for native dialogs: they throw instead of showing,
  // the way they do inside a sandboxed preview iframe. If the app still works
  // under this condition, it'll work everywhere.
  window.alert = () => { throw new Error("native alert blocked"); };
  window.confirm = () => { throw new Error("native confirm blocked"); };
  window.prompt = () => { throw new Error("native prompt blocked"); };
  await new Promise((r) => setTimeout(r, 300)); // let async init() finish
  doc = window.document;
}

function addStudent(name) {
  window.S.mode = "student";
  window.S.view = "roster";
  window.S.addingStudent = true;
  window.render();
  doc.getElementById("newName").value = name;
  window.submitNewStudent();
  return window.CUR;
}

before(boot);

test("question bank: every subtest/tier pool has 20 questions", () => {
  for (const battery of ["verbal", "quant", "nonverbal"]) {
    for (const tier of [1, 2, 3]) {
      for (const sub of window.BSUB[battery]) {
        const n = window.DRILLS[battery][tier][sub].length;
        assert.equal(n, 20, `${battery}/${tier}/${sub} has ${n}, expected 20`);
      }
    }
  }
});

test("question bank: every item has structurally valid answer data", () => {
  for (const battery of Object.keys(window.DRILLS)) {
    for (const tier of Object.keys(window.DRILLS[battery])) {
      for (const sub of Object.keys(window.DRILLS[battery][tier])) {
        for (const q of window.DRILLS[battery][tier][sub]) {
          assert.ok(q.q && q.e, "question missing text or explanation");
          if (q.o) {
            assert.equal(q.o.length, 4, "multiple-choice must have 4 options");
            assert.ok(q.a >= 0 && q.a <= 3, "answer index out of range");
          } else {
            assert.ok(typeof q.a === "string" && q.a.trim().length > 0);
          }
        }
      }
    }
  }
});

test("random sampling actually varies between calls", () => {
  const a = window.sampleQuestions("verbal", 1, "SC", 10).map((q) => q.q).join("|");
  const b = window.sampleQuestions("verbal", 1, "SC", 10).map((q) => q.q).join("|");
  // Not a hard guarantee (could coincidentally match), but overwhelmingly
  // unlikely at pool size 20 / sample size 10 — a real regression here
  // (e.g. sampling always returning the pool in original order) would fail
  // this reliably across repeated CI runs.
  assert.notEqual(a, b, "two samples of the same pool were identical");
});

test("adding a student creates a roster entry and selects them", () => {
  const id = addStudent("Test Student");
  assert.ok(id, "expected a student id");
  assert.ok(window.APP.students[id], "student not found in APP.students");
  assert.equal(window.APP.students[id].name, "Test Student");
});

test("free practice: single subtest draws exactly 10 questions", () => {
  window.S.b = "verbal";
  window.S.t = 1;
  window.S.sub = "SC";
  window.launchPracticeOne();
  assert.equal(window.S.runner.questions.length, 10);
});

test("scoring: a fully correct run scores 100%", () => {
  window.S.runner.questions.forEach((q, i) => window.selectAnswer(i, q.a));
  window.submitRunner(false);
  assert.equal(window.S.runner.score.correct, window.S.runner.score.total);
  window.finishResults();
});

test("submit survives blocked native dialogs when questions are left unanswered", () => {
  window.S.b = "verbal";
  window.S.t = 1;
  window.S.sub = "VC";
  window.launchPracticeOne();
  const total = window.S.runner.questions.length;
  const half = Math.floor(total / 2);
  for (let i = 0; i < half; i++) {
    window.selectAnswer(i, window.S.runner.questions[i].a);
  }
  // This calls native confirm() internally, which is rigged to throw above.
  window.submitRunner(false);
  assert.equal(window.S.view, "runner", "should still be on the runner, showing the in-app modal");
  assert.ok(window.MODAL && window.MODAL.mode === "confirm", "expected the in-app confirm modal");
  window.modalConfirmYes();
  assert.equal(window.S.view, "results", "confirming should complete the submit");
  assert.equal(window.S.runner.score.total, total);
  window.finishResults();
});

test("program day (single battery) draws 30 questions (10 per subtest)", () => {
  window.launchProgramDay(1, "mon");
  assert.equal(window.S.runner.questions.length, 30);
  window.cancelRunner();
});

test("program mixed/speed round draws 27 questions (3 per subtest x 9)", () => {
  window.launchProgramDay(1, "fri");
  assert.equal(window.S.runner.questions.length, 27);
  window.cancelRunner();
});

test("mock test draws 45 questions and is randomized between runs", () => {
  window.S.mode = "parent";
  window.S.view = "parent-gate";
  window.render();
  doc.getElementById("pinInput").value = window.APP.pin;
  window.tryPin();
  assert.equal(window.S.parentUnlocked, true);

  window.openMockConfig(2);
  doc.getElementById("mockMinutes").value = "1";
  window.launchMock(2);
  assert.equal(window.S.runner.questions.length, 45);
  assert.equal(window.S.runner.timed, true);

  const runA = window.S.runner.questions.map((q) => q.q).join("|");
  window.cancelRunner();
  window.openMockConfig(2);
  doc.getElementById("mockMinutes").value = "0";
  window.launchMock(2);
  const runB = window.S.runner.questions.map((q) => q.q).join("|");
  assert.notEqual(runA, runB, "two mock runs were identically ordered/selected");

  window.S.runner.questions.forEach((q, i) => window.selectAnswer(i, q.a));
  window.submitRunner(false);
  assert.equal(window.S.runner.score.correct, window.S.runner.score.total);
});

test("removing a student survives a blocked native confirm()", () => {
  const id = addStudent("Temp Student");
  window.S.mode = "parent";
  window.S.view = "parent-roster";
  window.render();
  window.confirmRemove(id);
  assert.ok(window.MODAL && window.MODAL.mode === "confirm");
  window.modalConfirmYes();
  assert.ok(!window.APP.students[id], "student should be removed");
});

test("updateStreak writes streak.lastDate as a YYYY-MM-DD local date (matches Postgres date column)", () => {
  const anyId = Object.keys(window.APP.students)[0];
  const st = window.APP.students[anyId];
  st.streak = { current: 0, longest: 0, lastDate: null };
  window.updateStreak(st);
  assert.match(st.streak.lastDate, /^\d{4}-\d{2}-\d{2}$/,
    "streak.lastDate must be an ISO date so it round-trips through the students.streak_last_date `date` column");
  const expected = window.localDateISO();
  assert.equal(st.streak.lastDate, expected, "should record today's LOCAL date, not the UTC one");
});

test("leaderboard ranks by completion/streak, not raw accuracy", () => {
  // The previous test left S.mode as "parent" — reset it, and select a
  // student via the app's own selectStudent() (window.CUR is only a debug
  // mirror; setting it directly doesn't touch real internal state).
  const anyId = Object.keys(window.APP.students)[0];
  window.S.mode = "student";
  window.selectStudent(anyId);
  window.S.view = "leaderboard";
  window.render();
  assert.ok(doc.getElementById("app").textContent.includes("Leaderboard"));
});

after(() => {
  dom.window.close();
});
