// Store layer (Epic 1, E1-5).
//
// Boots src/app.html with a stubbed Supabase client that captures every
// query the Store fires, so we can round-trip load -> mutate -> save
// without a real Postgres. Complements tests/auth.test.mjs.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const HTML_PATH = new URL("../src/app.html", import.meta.url);

// A minimal chainable stand-in for the supabase-js query builder. Enough to
// support the exact query shapes Store.js emits — not a general fixture.
// Each `.from(table)` opens a new builder. Terminal methods return { data,
// error } shaped like supabase-js.
function makeSupabaseStub(seed) {
  const tables = JSON.parse(JSON.stringify(seed));
  const log = [];

  function builder(table) {
    let mode = null;                // null until an action verb is called
    let columns = "*";
    const filters = [];
    let single = false;
    let orderBy = null;
    let orderAsc = true;
    let limit = null;
    let insertRows = null;
    let upsertRows = null;
    let deleteFilters = false;
    let updatePayload = null;

    const rowsFor = () => tables[table] || (tables[table] = []);

    function applyFilters(rows) {
      let out = rows;
      for (const f of filters) {
        if (f.op === "eq") out = out.filter((r) => r[f.col] === f.val);
        else if (f.op === "in") out = out.filter((r) => f.vals.includes(r[f.col]));
      }
      return out;
    }

    const api = {
      select(cols) {
        // Only .select() before any mutating verb registers as an action.
        // After .insert()/.upsert(), .select() is a Postgrest "returning"
        // modifier — like real supabase-js, we keep the mode and just
        // record which columns should come back.
        if (mode === null) mode = "select";
        columns = cols || "*";
        return terminalOr(api);
      },
      insert(rows) { mode = "insert"; insertRows = Array.isArray(rows) ? rows : [rows]; return terminalOr(api); },
      upsert(rows) { mode = "upsert"; upsertRows = Array.isArray(rows) ? rows : [rows]; return terminalOr(api); },
      update(payload) { mode = "update"; updatePayload = payload; return terminalOr(api); },
      delete() { mode = "delete"; deleteFilters = true; return terminalOr(api); },
      eq(col, val) { filters.push({ op: "eq", col, val }); return terminalOr(api); },
      in(col, vals) { filters.push({ op: "in", col, vals }); return terminalOr(api); },
      order(col, opts) { orderBy = col; orderAsc = !opts || opts.ascending !== false; return terminalOr(api); },
      limit(n) { limit = n; return terminalOr(api); },
      maybeSingle() { single = true; return terminate(); },
      single() { single = true; return terminate(); },
      then(onFulfilled, onRejected) { return terminate().then(onFulfilled, onRejected); },
    };

    function terminalOr(a) { return a; }

    async function terminate() {
      log.push({ table, mode, columns, filters: [...filters], insertRows, upsertRows, updatePayload, deleteFilters, orderBy, orderAsc, limit });
      let data, error = null;
      if (mode === "select") {
        let out = applyFilters(rowsFor());
        if (orderBy) out = [...out].sort((a, b) => (a[orderBy] > b[orderBy] ? 1 : -1) * (orderAsc ? 1 : -1));
        if (limit) out = out.slice(0, limit);
        data = single ? (out[0] || null) : out;
      } else if (mode === "insert") {
        rowsFor().push(...insertRows);
        data = insertRows.map((r) => ({ ...r }));
      } else if (mode === "upsert") {
        const bucket = rowsFor();
        for (const r of upsertRows) {
          const idx = bucket.findIndex((x) => x.id === r.id);
          if (idx >= 0) bucket[idx] = { ...bucket[idx], ...r };
          else bucket.push({ ...r });
        }
        data = upsertRows.map((r) => ({ ...r }));
      } else if (mode === "delete") {
        const bucket = rowsFor();
        const kept = [];
        for (const row of bucket) {
          let matches = true;
          for (const f of filters) {
            if (f.op === "eq" && row[f.col] !== f.val) matches = false;
            if (f.op === "in" && !f.vals.includes(row[f.col])) matches = false;
          }
          if (!matches) kept.push(row);
        }
        tables[table] = kept;
        data = [];
      }
      return { data, error };
    }

    return api;
  }

  return {
    _tables: tables,
    _log: log,
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "u1", email: "p@example.com" }, access_token: "t" } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }),
    },
    from(table) { return builder(table); },
  };
}

let dom, window, doc, supa;

async function boot(seed) {
  const html = readFileSync(HTML_PATH, "utf-8");
  supa = makeSupabaseStub(seed);
  dom = new JSDOM(html, {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    url: HTML_PATH.href,
    beforeParse(win) {
      win.__HICAP_CONFIG = { supabaseUrl: "https://fake.supabase.co", supabaseAnonKey: "fake" };
      win.__HICAP_TEST_CLIENT = supa;
    },
  });
  window = dom.window;
  window.alert = () => { throw new Error("native alert blocked"); };
  window.confirm = () => { throw new Error("native confirm blocked"); };
  window.prompt = () => { throw new Error("native prompt blocked"); };
  await new Promise((r) => setTimeout(r, 800));
  doc = window.document;
}

const FAMILY_ID = "fam-1";
const seedData = () => ({
  families: [{ id: FAMILY_ID, owner_id: "u1", parent_pin_hash: null }],
  students: [
    { id: "stu-a", family_id: FAMILY_ID, name: "Alice", avatar: "🦊", color: "#3B6E5E",
      grade: 7, cogat_level: 13, streak_current: 3, streak_longest: 5, streak_last_date: null,
      badges_seen: [], created_at: "2026-01-01T00:00:00Z" },
  ],
  attempts: [
    { id: "att-1", student_id: "stu-a", family_id: FAMILY_ID, taken_at: "2026-01-05T00:00:00Z",
      title: "Verbal Tier 1 · Sentence Completion", kind: "practice", week_key: null,
      correct: 8, total: 10, by_sub: { SC: { c: 8, n: 10 } }, wrong_questions: [] },
  ],
});

before(() => boot(seedData()));
after(() => dom.window.close());

test("cloud load reconstructs the APP snapshot from families/students/attempts", () => {
  const app = window.APP;
  assert.equal(app._familyId, FAMILY_ID);
  assert.deepEqual(Object.keys(app.students), ["stu-a"]);
  const alice = app.students["stu-a"];
  assert.equal(alice.name, "Alice");
  assert.equal(alice.grade, 7);
  assert.equal(alice.cogatLevel, 13);
  assert.equal(alice.streak.current, 3);
  assert.equal(alice.streak.longest, 5);
  assert.equal(alice.history.length, 1);
  assert.equal(alice.history[0].title, "Verbal Tier 1 · Sentence Completion");
  assert.equal(alice.history[0]._saved, true, "loaded attempts should be marked saved so save() skips them");
});

test("adding a student via the UI issues a students upsert on save", async () => {
  window.S.mode = "student"; window.S.view = "roster"; window.S.addingStudent = true; window.render();
  doc.getElementById("newName").value = "Bobby";
  window.submitNewStudent();
  // saveApp is fire-and-forget; give the microtask queue a beat.
  await new Promise((r) => setTimeout(r, 100));
  const upsert = supa._log.find((c) => c.table === "students" && c.mode === "upsert");
  assert.ok(upsert, "expected a students upsert");
  const names = upsert.upsertRows.map((r) => r.name);
  assert.equal(names.length, 2, `expected two students in upsert, got ${JSON.stringify(names)}`);
  assert.ok(names.includes("Alice"));
  assert.ok(names.includes("Bobby"));
  const bobby = upsert.upsertRows.find((r) => r.name === "Bobby");
  assert.equal(bobby.family_id, FAMILY_ID);
  assert.equal(bobby.grade, 7);
  assert.equal(bobby.cogat_level, 13);
});

test("a new locally-created attempt is inserted (not re-inserted on the next save)", async () => {
  const before = supa._log.filter((c) => c.table === "attempts" && c.mode === "insert").length;
  const bobbyId = Object.values(window.APP.students).find((s) => s.name === "Bobby").id;
  window.selectStudent(bobbyId);
  window.S.b = "verbal"; window.S.t = 1; window.S.sub = "SC";
  window.launchPracticeOne();
  window.S.runner.questions.forEach((q, i) => window.selectAnswer(i, q.a));
  window.submitRunner(false);
  window.finishResults();
  await new Promise((r) => setTimeout(r, 200));

  const inserts = supa._log.filter((c) => c.table === "attempts" && c.mode === "insert");
  assert.ok(inserts.length > before, "expected at least one attempts insert");
  const inserted = inserts[inserts.length - 1].insertRows;
  assert.equal(inserted.length, 1, "should have inserted exactly one new attempt");
  assert.equal(inserted[0].student_id, bobbyId);
  assert.equal(inserted[0].family_id, FAMILY_ID);

  // Trigger another save (e.g. by mutating a student) and confirm the same
  // attempt does NOT get inserted a second time — the _saved flag should
  // suppress it.
  const beforeSecond = supa._log.filter((c) => c.table === "attempts" && c.mode === "insert").length;
  window.saveApp();
  await new Promise((r) => setTimeout(r, 40));
  const afterSecond = supa._log.filter((c) => c.table === "attempts" && c.mode === "insert").length;
  assert.equal(afterSecond, beforeSecond, "no second insert for the same attempt");
});
