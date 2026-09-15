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
