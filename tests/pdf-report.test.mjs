// PDF progress report (Epic 4, E4-5).
//
// buildProgressReportHTML(st) is a pure function of a student object, so
// testing it is straightforward: boot the app, create a student with some
// history, call the function, and assert the output looks right.

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

function addStudentAndTakePractice() {
  const doc = window.document;
  window.S.mode = "student"; window.S.view = "roster";
  window.S.addingStudent = true; window.render();
  doc.getElementById("newName").value = "Test Student";
  window.submitNewStudent();
  window.S.b = "verbal"; window.S.t = 1; window.S.sub = "SC";
  window.launchPracticeOne();
  window.S.runner.questions.forEach((q, i) => window.selectAnswer(i, q.a));
  window.submitRunner(false);
  window.finishResults();
}

before(async () => { await boot(); addStudentAndTakePractice(); });
after(() => dom.window.close());

test("buildProgressReportHTML is defined", () => {
  assert.equal(typeof window.buildProgressReportHTML, "function");
});

test("printProgressReport is defined", () => {
  assert.equal(typeof window.printProgressReport, "function");
});

test("buildProgressReportHTML returns a full HTML document", () => {
  const studentId = Object.keys(window.APP.students)[0];
  const st = window.APP.students[studentId];
  const html = window.buildProgressReportHTML(st);
  assert.ok(typeof html === "string" && html.length > 0, "should return non-empty string");
  assert.ok(html.startsWith("<!DOCTYPE html>"), "should be a full HTML document");
  assert.ok(html.includes("</html>"), "should close the html tag");
});

test("buildProgressReportHTML includes the student name", () => {
  const st = Object.values(window.APP.students)[0];
  const html = window.buildProgressReportHTML(st);
  assert.ok(html.includes("Test Student"), "report should contain the student name");
});

test("buildProgressReportHTML includes the disclaimer", () => {
  const st = Object.values(window.APP.students)[0];
  const html = window.buildProgressReportHTML(st);
  assert.ok(html.includes("not affiliated with or endorsed by Riverside Insights"), "disclaimer must appear");
});

test("buildProgressReportHTML includes all three strand labels", () => {
  const st = Object.values(window.APP.students)[0];
  const html = window.buildProgressReportHTML(st);
  assert.ok(html.includes("Verbal reasoning"), "should include verbal strand");
  assert.ok(html.includes("Quantitative reasoning"), "should include quant strand");
  assert.ok(html.includes("Nonverbal reasoning"), "should include nonverbal strand");
});

test("buildProgressReportHTML shows recent session in the table", () => {
  const st = Object.values(window.APP.students)[0];
  assert.ok(st.history.length >= 1, "student should have at least one session");
  const html = window.buildProgressReportHTML(st);
  assert.ok(html.includes("verbal"), "session kind or subtest should appear");
});

test("buildProgressReportHTML handles a brand-new student with no history", () => {
  const blankSt = {
    id: "x", name: "New Kid", grade: 7, cogatLevel: 13,
    history: [], streak: { current: 0, longest: 0, lastDate: null },
  };
  const html = window.buildProgressReportHTML(blankSt);
  assert.ok(html.includes("New Kid"), "name should appear");
  assert.ok(html.includes("No sessions yet."), "should show empty state for sessions");
  assert.ok(html.includes("No badges earned yet."), "should show empty state for badges");
});

// ---------------------------------------------------------------------------
// Substantive content test: fixture student with real-shaped history
//
// Verifies every section of the report has real data — not empty states or
// placeholder text. A fixture is constructed with deterministic, known values
// so the assertions can be exact rather than "something appeared".
//
// Fixture design:
//   Verbal  (SC subtest): 3 sessions × 18/20 correct = 90% → earns Verbal Ace
//   Quant   (NS subtest): 3 sessions × 17/20 correct = 85% → earns Quant Ace
//   Nonverbal (FC):       3 sessions × 16/20 correct = 80% → not an ace
//   Mock session:         45 questions, 38/45 = 84%  → earns Mock Milestone
//   streak.longest = 5                                → earns 3-Day Streak
//   All of the above triggers "First Steps" as well.
// ---------------------------------------------------------------------------
test("buildProgressReportHTML — fixture with real-shaped history: all sections contain substantive data", () => {
  function makeSession(sub, c, total) {
    return {
      _saved: true, date: new Date(Date.now() - Math.random()*1e9).toISOString(),
      title: `${sub} practice`, kind: "practice",
      weekKey: null, correct: c, total,
      bySub: { [sub]: { c, n: total } }, wrongQuestions: [],
    };
  }
  // Mock session: bySub is empty so it doesn't skew battery accuracy ratios,
  // but kind="mock" triggers the Mock Milestone badge and appears in session table.
  const mockSession = {
    _saved: true, date: new Date(Date.now() - 5*24*60*60*1000).toISOString(),
    title: "Mock Test 1", kind: "mock",
    weekKey: null, correct: 38, total: 45,
    bySub: {}, wrongQuestions: [],
  };
  const fixture = {
    id: "fixture-rich",
    name: "Alex Fixture",
    grade: 7,
    cogatLevel: 13,
    createdAt: new Date(Date.now() - 30*24*60*60*1000).toISOString(),
    streak: { current: 2, longest: 5, lastDate: new Date().toISOString().slice(0,10) },
    badgesSeen: [],
    poolCursors: {},
    history: [
      // 3 verbal sessions at 90%  → Verbal Ace: 54/60 = 0.90 ≥ 0.85 ✓
      makeSession("SC", 18, 20), makeSession("SC", 18, 20), makeSession("SC", 18, 20),
      // 3 quant sessions at 85%   → Quant Ace:  51/60 = 0.85 ≥ 0.85 ✓
      makeSession("NS", 17, 20), makeSession("NS", 17, 20), makeSession("NS", 17, 20),
      // 3 nonverbal sessions at 80% → Spatial Ace: 48/60 = 0.80 < 0.85 ✗
      makeSession("FC", 16, 20), makeSession("FC", 16, 20), makeSession("FC", 16, 20),
      // 1 mock (empty bySub keeps accuracy ratios exact; triggers Mock Milestone badge)
      mockSession,
    ],
  };

  const html = window.buildProgressReportHTML(fixture);

  // --- Student identity ---
  assert.ok(html.includes("Alex Fixture"), "student name must appear");
  assert.ok(html.includes("Grade 7"), "grade must appear");

  // --- Progress ring: 0 program lessons done (none are 'program' kind), so 0/70
  //     but the ring SVG itself must be present regardless ---
  assert.match(html, /<svg[^>]+width="80"/, "completion ring SVG must be present");

  // --- Mastery bars: all three strands must show real percentages, not 'not yet measured' ---
  assert.ok(!html.includes("Verbal reasoning</span><span style=\"color:#7c6f62;\">not yet measured"),
    "verbal bar must show a real percentage, not 'not yet measured'");
  assert.ok(!html.includes("Quantitative reasoning</span><span style=\"color:#7c6f62;\">not yet measured"),
    "quant bar must show a real percentage, not 'not yet measured'");
  assert.ok(!html.includes("Nonverbal reasoning</span><span style=\"color:#7c6f62;\">not yet measured"),
    "nonverbal bar must show a real percentage, not 'not yet measured'");
  // Exact percentages from the fixture
  assert.match(html, /Verbal reasoning[\s\S]{0,200}90%/,
    "verbal mastery must show 90% (18×3 / 20×3 = 90%)");
  assert.match(html, /Quantitative reasoning[\s\S]{0,200}85%/,
    "quant mastery must show 85% (17×3 / 20×3 = 85%)");
  assert.match(html, /Nonverbal reasoning[\s\S]{0,200}80%/,
    "nonverbal mastery must show 80% (16×3 / 20×3 = 80%)");

  // --- Badges: specific earned badges must appear, not 'No badges earned yet' ---
  assert.ok(!html.includes("No badges earned yet."),
    "badge section must not show the empty-state placeholder");
  assert.ok(html.includes("First Steps"),      "First Steps badge must appear (history.length > 0)");
  assert.ok(html.includes("3-Day Streak"),     "3-Day Streak badge must appear (longest=5 ≥ 3)");
  assert.ok(html.includes("Mock Milestone"),   "Mock Milestone badge must appear (mock session present)");
  assert.ok(html.includes("Verbal Ace"),       "Verbal Ace badge must appear (3 sessions at 90%)");
  assert.ok(html.includes("Quant Ace"),        "Quant Ace badge must appear (3 sessions at 85%)");
  assert.ok(!html.includes("Spatial Ace"),     "Spatial Ace must NOT appear (nonverbal at 80% < 85%)");

  // --- Session table: real rows, not the 'No sessions yet' placeholder ---
  assert.ok(!html.includes("No sessions yet."),
    "session table must not show the empty-state placeholder");
  // Table shows the 10 most recent sessions; all 10 of our fixture sessions must produce rows.
  // Check that at least one score cell with a real fraction appears.
  assert.match(html, /18\/20/, "session table must contain a real score (18/20 from verbal sessions)");
  assert.match(html, /38\/45/, "session table must contain the mock session score (38/45)");

  // --- Disclaimer still present ---
  assert.ok(html.includes("not affiliated with or endorsed by Riverside Insights"),
    "legal disclaimer must still appear in the rich-fixture report");
});
