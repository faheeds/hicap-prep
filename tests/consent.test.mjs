// COPPA parental consent flow (Epic 2, E2-2).
//
// Boots the app in cloud mode with a signed-in session but
// families.consented_at = null. Verifies:
//   1. The consent screen is shown, not the roster.
//   2. The "continue" button is disabled until both checkboxes are ticked.
//   3. Submitting fires an UPDATE families set consented_at = ... eq id.
//   4. After success, the gate steps aside and the roster becomes visible.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const HTML_PATH = new URL("../src/app.html", import.meta.url);

const FAMILY_ID = "fam-consent";

function makeSupabaseStub(seed) {
  const tables = JSON.parse(JSON.stringify(seed));
  const log = [];

  function builder(table) {
    let mode = null, columns = "*";
    const filters = [];
    let single = false, orderBy = null, orderAsc = true, limit = null;
    let insertRows = null, upsertRows = null, updatePayload = null;

    const rowsFor = () => tables[table] || (tables[table] = []);
    function applyFilters(rows) {
      let out = rows;
      for (const f of filters) {
        if (f.op === "eq") out = out.filter((r) => r[f.col] === f.val);
        if (f.op === "in") out = out.filter((r) => f.vals.includes(r[f.col]));
      }
      return out;
    }
    const api = {
      select(cols) { if (mode === null) mode = "select"; columns = cols || "*"; return api; },
      insert(rows) { mode = "insert"; insertRows = Array.isArray(rows) ? rows : [rows]; return api; },
      upsert(rows) { mode = "upsert"; upsertRows = Array.isArray(rows) ? rows : [rows]; return api; },
      update(payload) { mode = "update"; updatePayload = payload; return api; },
      delete() { mode = "delete"; return api; },
      eq(col, val) { filters.push({ op: "eq", col, val }); return api; },
      in(col, vals) { filters.push({ op: "in", col, vals }); return api; },
      order(col, opts) { orderBy = col; orderAsc = !opts || opts.ascending !== false; return api; },
      limit(n) { limit = n; return api; },
      maybeSingle() { single = true; return terminate(); },
      single() { single = true; return terminate(); },
      then(a, b) { return terminate().then(a, b); },
    };
    async function terminate() {
      log.push({ table, mode, filters: [...filters], updatePayload, insertRows, upsertRows });
      let data = null, error = null;
      if (mode === "select" || mode === null) {
        let out = applyFilters(rowsFor());
        if (orderBy) out = [...out].sort((a, b) => (a[orderBy] > b[orderBy] ? 1 : -1) * (orderAsc ? 1 : -1));
        if (limit) out = out.slice(0, limit);
        data = single ? (out[0] || null) : out;
      } else if (mode === "insert") {
        rowsFor().push(...insertRows); data = insertRows.map((r) => ({ ...r }));
      } else if (mode === "upsert") {
        for (const r of upsertRows) {
          const idx = rowsFor().findIndex((x) => x.id === r.id);
          if (idx >= 0) rowsFor()[idx] = { ...rowsFor()[idx], ...r };
          else rowsFor().push({ ...r });
        }
        data = upsertRows.map((r) => ({ ...r }));
      } else if (mode === "update") {
        const bucket = applyFilters(rowsFor());
        for (const row of bucket) Object.assign(row, updatePayload);
        data = bucket.map((r) => ({ ...r }));
      } else if (mode === "delete") {
        tables[table] = rowsFor().filter((r) => !applyFilters([r]).length);
        data = [];
      }
      return { data, error };
    }
    return api;
  }

  return {
    _tables: tables, _log: log,
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "u1", email: "p@example.com" }, access_token: "t" } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }),
    },
    from(table) { return builder(table); },
  };
}

let dom, window, doc, supa;

async function boot() {
  const html = readFileSync(HTML_PATH, "utf-8");
  supa = makeSupabaseStub({
    families: [{ id: FAMILY_ID, owner_id: "u1", parent_pin_hash: null, consented_at: null }],
    students: [],
    attempts: [],
  });
  dom = new JSDOM(html, {
    runScripts: "dangerously", resources: "usable", pretendToBeVisual: true,
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

before(boot);
after(() => dom.window.close());

test("consent gate: shown instead of the roster when consented_at is null", () => {
  assert.equal(window.needsConsentGate(), true, "cloud + no consent should force the gate");
  const body = doc.getElementById("app").innerHTML;
  assert.match(body, /Before you add your kids/i, "consent screen should render");
  assert.doesNotMatch(body, /Who's practicing today/i, "roster should be hidden");
});

test("consent gate: continue button is disabled until both checkboxes are ticked", () => {
  // Mutate the mirrored state rather than reassigning window.CONSENT_UI —
  // the internal `let CONSENT_UI` binding wouldn't see a reassignment.
  Object.assign(window.CONSENT_UI, { parentBox: false, policyBox: false, err: "", busy: false });
  window.render();
  assert.ok(doc.querySelector('button.forest').disabled, "no boxes ticked -> button disabled");

  Object.assign(window.CONSENT_UI, { parentBox: true, policyBox: false });
  window.render();
  assert.ok(doc.querySelector('button.forest').disabled, "only one box -> still disabled");

  Object.assign(window.CONSENT_UI, { parentBox: true, policyBox: true });
  window.render();
  assert.ok(!doc.querySelector('button.forest').disabled, "both ticked -> enabled");
});

test("consent gate: submit updates families.consented_at and dismisses the gate", async () => {
  Object.assign(window.CONSENT_UI, { parentBox: true, policyBox: true, err: "", busy: false });
  window.render();
  const logBefore = supa._log.length;
  await window.submitConsent();
  const update = supa._log.slice(logBefore).find((c) => c.table === "families" && c.mode === "update");
  assert.ok(update, "expected an UPDATE families ... set consented_at");
  assert.ok(update.updatePayload && update.updatePayload.consented_at, "payload should carry consented_at");
  assert.ok(update.filters.find((f) => f.col === "id" && f.val === FAMILY_ID), "should scope UPDATE to this family's id");

  assert.equal(window.needsConsentGate(), false, "gate should drop after consent");
  const body = doc.getElementById("app").innerHTML;
  assert.match(body, /Who's practicing today/i, "roster should now be visible");
});
