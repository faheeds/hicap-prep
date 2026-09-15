// Data export (Epic 1, E1-8).
//
// The export helpers are pure functions of APP, so we can drive them from
// the smoke-style boot: add a student, submit a practice run, then call
// buildExportSnapshot() / buildExportCSV() and check the shape.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const HTML_PATH = new URL("../src/app.html", import.meta.url);

let dom, window, doc;

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
  doc = window.document;
}

function addStudentAndTakePractice() {
  window.S.mode = "student"; window.S.view = "roster"; window.S.addingStudent = true; window.render();
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

test("buildExportSnapshot() includes every student and their full history", () => {
  const snap = window.buildExportSnapshot();
  assert.ok(snap.exportedAt, "should carry an ISO timestamp");
  assert.equal(snap.students.length, 1);
  const st = snap.students[0];
  assert.equal(st.name, "Test Student");
  assert.equal(st.history.length, 1);
  const h = st.history[0];
  assert.equal(h.kind, "practice");
  assert.equal(h.correct, h.total, "the fixture answers every question correctly");
  assert.ok(h.bySub && Object.keys(h.bySub).length > 0);
});

test("buildExportCSV() emits an RFC 4180 header row plus one row per attempt", () => {
  const csv = window.buildExportCSV();
  const lines = csv.split("\n");
  assert.equal(lines[0], "student_name,date,kind,title,week_key,correct,total,percent,subtests");
  assert.equal(lines.length, 2, "one attempt was logged, so exactly one data row");
  const cells = lines[1].split(",");
  // Cell 0 = student_name; commas inside titles get quoted by csvCell, so
  // splitting on bare commas is safe here because "Test Student" has no comma.
  assert.equal(cells[0], "Test Student");
  assert.equal(cells[2], "practice");
});

test("csvCell() escapes commas / quotes / newlines per RFC 4180", () => {
  const fn = window.csvCell;
  assert.equal(fn("plain"), "plain");
  assert.equal(fn("with, comma"), '"with, comma"');
  assert.equal(fn('has "quotes"'), '"has ""quotes"""');
  assert.equal(fn("line\nbreak"), '"line\nbreak"');
  assert.equal(fn(null), "");
});

test("exportAsJSON() triggers a JSON blob download with a dated filename", () => {
  let created = null;
  const origCreateURL = window.URL.createObjectURL;
  const origAppend = window.document.body.appendChild.bind(window.document.body);
  window.URL.createObjectURL = (blob) => { created = { blob }; return "blob:fake"; };
  const anchors = [];
  window.document.body.appendChild = function (node) {
    if (node && node.tagName === "A") { anchors.push(node); node.click = () => {}; }
    return origAppend(node);
  };
  window.exportAsJSON();
  window.URL.createObjectURL = origCreateURL;
  window.document.body.appendChild = origAppend;
  assert.ok(created && created.blob, "should have created a blob");
  assert.equal(created.blob.type, "application/json");
  assert.ok(anchors.length >= 1, "should have appended an anchor to click");
  assert.match(anchors[anchors.length - 1].download, /^hicap-prep-\d{4}-\d{2}-\d{2}\.json$/);
});
