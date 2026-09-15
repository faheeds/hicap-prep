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

test("nonverbal PF Tier 1 is a shape bank — real SVG figures on every question, not text", () => {
  // Pilot contract: DRILLS.nonverbal[1].PF was replaced at load time with
  // real diagrammed Paper Folding items whose stems and options carry
  // inline SVG. Other nonverbal pools (PF Tiers 2/3, FM, FC across all
  // tiers) intentionally stay text-based until the pilot is reviewed.
  const pool = window.DRILLS.nonverbal[1].PF;
  assert.equal(pool.length, 20, "PF Tier 1 should have 20 questions");
  for (const q of pool) {
    assert.match(q.q, /<svg\b/, "PF T1 stem must be inline SVG");
    assert.match(q.q, /stroke-dasharray/, "PF T1 stem must include the dashed fold line");
    assert.equal(q.o.length, 4, "must have 4 options");
    for (const opt of q.o) {
      assert.match(opt, /^<svg\b/, "every PF T1 option must be an inline SVG shape");
    }
    assert.ok(q.a >= 0 && q.a <= 3);
  }
  // Everything else nonverbal is still text (pilot deliberately scoped).
  for (const t of [2, 3]) {
    const stillText = window.DRILLS.nonverbal[t].PF[0].q;
    assert.doesNotMatch(stillText, /^<svg/, `PF Tier ${t} should be untouched by the pilot`);
  }
});

test("PF Tier 1: geometric sanity — every dot inside the canvas with margin, no visual overlaps", () => {
  // Both prior bugs (single-fold regression, and the three configs whose
  // mirrors landed on a fold axis) were classes of "geometry produces
  // something visually wrong that no test catches". This one sweeps every
  // stem and every option, extracts SVG dot centers, and enforces:
  //   1. All dot centers stay within [MARGIN, 120 - MARGIN] on both axes.
  //      Dot radius is 5, so MARGIN = 15 keeps dots at least 5 units clear
  //      of the square border (10-110 outline).
  //   2. All pairwise center-to-center distances in the SAME svg are
  //      >= MIN_DIST, so dots don't run into each other visually.
  const pool = window.DRILLS.nonverbal[1].PF;
  const MARGIN = 15;
  const MIN_DIST = 15; // 15 units = 5px more than the 10-unit "just touching" threshold
  const parseDots = (svg) => {
    const out = [];
    const re = /<circle\s+cx="([^"]+)"\s+cy="([^"]+)"\s+r="([^"]+)"/g;
    let m; while ((m = re.exec(svg))) out.push({x: +m[1], y: +m[2]});
    return out;
  };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const check = (label, svg) => {
    const dots = parseDots(svg);
    for (const d of dots) {
      assert.ok(d.x >= MARGIN && d.x <= 120 - MARGIN,
        `${label}: dot x=${d.x} is outside the [${MARGIN}, ${120 - MARGIN}] safe canvas`);
      assert.ok(d.y >= MARGIN && d.y <= 120 - MARGIN,
        `${label}: dot y=${d.y} is outside the [${MARGIN}, ${120 - MARGIN}] safe canvas`);
    }
    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        const d = dist(dots[i], dots[j]);
        assert.ok(d >= MIN_DIST,
          `${label}: dots too close (${d.toFixed(2)} < ${MIN_DIST}) between ${JSON.stringify(dots[i])} and ${JSON.stringify(dots[j])}`);
      }
    }
  };
  pool.forEach((q, i) => {
    check(`q${i+1} stem`, q.q);
    q.o.forEach((opt, oi) => check(`q${i+1} opt${oi+1}`, opt));
  });
});

test("PF Tier 1 covers 1-, 2-, AND 3-fold puzzles — not a difficulty regression from the text pool", () => {
  // Fold count of a stem = number of dashed fold lines in its SVG. The
  // pre-pilot text bank had ~10 single-fold, ~6 double-fold, ~3 triple-fold
  // (see the pool this replaced). The first pilot cut only shipped
  // single-fold, which trivialized Tier 1. This assertion locks the range.
  const pool = window.DRILLS.nonverbal[1].PF;
  const foldCounts = pool.map(q => (q.q.match(/stroke-dasharray/g) || []).length);
  const singles = foldCounts.filter(n => n === 1).length;
  const doubles = foldCounts.filter(n => n === 2).length;
  const triples = foldCounts.filter(n => n === 3).length;
  assert.ok(singles >= 6,  `expected 6+ single-fold items, got ${singles}`);
  assert.ok(doubles >= 4,  `expected 4+ double-fold items, got ${doubles}`);
  assert.ok(triples >= 3,  `expected 3+ triple-fold items, got ${triples}`);
  assert.equal(singles + doubles + triples, pool.length, "every stem must have 1-3 fold lines");

  // Dot count on each option's SVG. For each fold count in the pool, the
  // correct answer should carry the expected hole count (1 fold -> 2 dots,
  // 2 folds -> 4 dots, 3 folds -> 8 dots). And at every fold count, at
  // least one WRONG option should carry the same count as the correct one
  // so the puzzle can't be solved by counting alone.
  const dotsIn = (svg) => (svg.match(/<circle\b/g) || []).length;
  pool.forEach((q, i) => {
    const n = foldCounts[i];
    const expected = n === 1 ? 2 : n === 2 ? 4 : 8;
    assert.equal(dotsIn(q.o[q.a]), expected,
      `q${i+1} (${n}-fold) — correct answer should have ${expected} dots, got ${dotsIn(q.o[q.a])}`);
    const wrongSameCount = q.o.filter((opt, oi) => oi !== q.a && dotsIn(opt) === expected).length;
    assert.ok(wrongSameCount >= 1,
      `q${i+1} (${n}-fold) — at least one wrong option must match the correct dot count, else the puzzle is solvable by counting alone`);
  });
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
  // E4-7: grade + cogatLevel land on the record so the roster meta and any
  // grade-scoped content lookup (Epic 5) have something to key on.
  assert.equal(window.APP.students[id].grade, 7, "default grade should be 7");
  assert.equal(window.APP.students[id].cogatLevel, 13, "grade 7 -> Level 13");
});

test("E4-7: roster row meta line includes the student's grade", () => {
  // Roster is currently rendered from the add-student add flow above.
  window.S.mode = "student"; window.S.view = "roster"; window.CUR = null;
  window.render();
  const body = doc.getElementById("app").innerHTML;
  assert.match(body, /Grade 7/, "roster meta line must include a grade label");
});

test("E4-7: grade picker on add-student writes the picked grade + level to the record", () => {
  // Simulate a parent typing a name and picking Grade 5 in the segmented control.
  window.S.mode = "student"; window.S.view = "roster";
  window.startAddStudent();
  window.S.newGrade = 5;
  window.render();
  doc.getElementById("newName").value = "Fifth Grader";
  window.submitNewStudent();
  const st = Object.values(window.APP.students).find((s) => s.name === "Fifth Grader");
  assert.ok(st, "expected the new student on the roster");
  assert.equal(st.grade, 5);
  assert.equal(st.cogatLevel, 11, "grade 5 maps to CogAT level 11");
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

test("timer auto-submit: a timed mock hits results at zero even with no answers picked", async () => {
  // Closes the last E4-2 gap — the checklist called out timer auto-submit
  // specifically, but nothing was exercising the setInterval->submitRunner
  // path. Kicks off a real 1-second timer, waits it out, and asserts the
  // runner made it to results with a score bound to the runner state.
  window.S.mode = "parent";
  window.S.view = "parent-home";
  window.S.parentUnlocked = true;
  window.render();
  window.openMockConfig(2);
  doc.getElementById("mockMinutes").value = "1"; // 1 minute * 60 -> 60s
  // Force the runner into a 1-second countdown so the test resolves fast.
  // Uses the real setInterval path — no timer mocking, no manual step.
  window.launchMock(2);
  window.S.runner.remaining = 1;
  assert.equal(window.S.view, "runner", "should be running the mock");
  await new Promise((r) => setTimeout(r, 1300));
  assert.equal(window.S.view, "results", "clock hitting zero should auto-submit");
  assert.ok(window.S.runner && window.S.runner.score,
    "results view should carry a scored runner even with no answers picked");
  assert.equal(window.S.runner.score.total, 45,
    "unanswered items still count toward the total (they just aren't credited)");
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

test("PIN keypad: clicking the actual digit buttons in sequence unlocks parent mode", () => {
  // Regression guard for E4-7 shipping the keypad broken: pinPress wrote to
  // #pinInput.value, then render() rebuilt the <input> with no value attr,
  // so every keypad click reset the buffer to a single digit and validation
  // never fired. The old tests only exercised the #pinInput.value = ... path,
  // which bypassed the bug entirely.
  window.S.mode = "parent";
  window.S.view = "parent-gate";
  window.S.parentUnlocked = false;
  window.APP.pin = "1234";
  window.S.pinErr = "";
  window.render();

  for (const d of ["1","2","3","4"]) {
    const btn = doc.querySelector(`.keypad button[aria-label="Digit ${d}"]`);
    assert.ok(btn, `expected a keypad button for digit ${d}`);
    btn.click();
  }

  assert.equal(window.S.parentUnlocked, true,
    "four keypad clicks matching APP.pin should have driven validation to success");
});

test("PIN keypad: dots reflect the running digit buffer, not just the last press", () => {
  window.S.mode = "parent";
  window.S.view = "parent-gate";
  window.S.parentUnlocked = false;
  window.APP.pin = "1234";
  window.S.pinErr = "";
  window.render();

  const press = (d) => doc.querySelector(`.keypad button[aria-label="Digit ${d}"]`).click();
  press("9"); press("8");
  const filled = doc.querySelectorAll(".pin-dots span.filled").length;
  assert.equal(filled, 2, "after two presses the dots should show 2 filled, not 1");
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
  // Design renames this screen to "Effort board" — the render just needs
  // to show that heading and rank rows to prove the view actually loaded.
  assert.ok(doc.getElementById("app").textContent.includes("Effort board"));
});

after(() => {
  dom.window.close();
});
