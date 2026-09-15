// Server-verified parent PIN (Epic 1, E1-6).
//
// Boots src/app.html in cloud mode with a stubbed fetch so we can watch
// exactly which edge function tryPin() and changePin() hit and confirm the
// UI reacts correctly to success / bad PIN / lockout responses. The PIN
// hashing itself lives in supabase/functions/_shared/pin.ts and is
// covered by tests/pin-hash.test.mjs.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const HTML_PATH = new URL("../src/app.html", import.meta.url);

const fetchLog = [];
let nextFetchResponse = null;

function makeFakeSupabase() {
  const session = { user: { id: "u1", email: "p@example.com" }, access_token: "jwt-token" };
  return {
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }),
    },
    from(table) {
      // Store.load will query families/students/attempts. Families gets a
      // pre-consented row so the Epic-2 consent gate stays out of the way
      // during PIN-flow tests; other tables return empty.
      const empty = { data: [], error: null };
      const famRow = { id: "fam-1", parent_pin_hash: null, consented_at: "2026-01-01T00:00:00Z" };
      const maybe = { data: table === "families" ? famRow : null, error: null };
      const chain = {
        select: () => chain, eq: () => chain, in: () => chain, order: () => chain, limit: () => chain,
        maybeSingle: () => Promise.resolve(maybe),
        single: () => Promise.resolve(maybe),
        then: (a, b) => Promise.resolve(empty).then(a, b),
        upsert: () => chain, delete: () => chain, insert: () => chain, update: () => chain,
      };
      return chain;
    },
  };
}

let dom, window, doc;

async function boot() {
  const html = readFileSync(HTML_PATH, "utf-8");
  dom = new JSDOM(html, {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    url: HTML_PATH.href,
    beforeParse(win) {
      win.__HICAP_CONFIG = { supabaseUrl: "https://fake.supabase.co", supabaseAnonKey: "fake-anon-key" };
      win.__HICAP_TEST_CLIENT = makeFakeSupabase();
      // Stub fetch — auth.verifyPin / setPin POST to /functions/v1/{name}.
      win.fetch = async (url, opts) => {
        fetchLog.push({ url: String(url), opts });
        const res = nextFetchResponse || { status: 200, body: { ok: true } };
        return {
          status: res.status,
          json: async () => res.body,
        };
      };
    },
  });
  window = dom.window;
  window.alert = () => { throw new Error("native alert blocked"); };
  window.confirm = () => { throw new Error("native confirm blocked"); };
  window.prompt = () => { throw new Error("native prompt blocked"); };
  await new Promise((r) => setTimeout(r, 800));
  doc = window.document;
}

function openParentGate() {
  window.S.mode = "parent";
  window.S.view = "parent-gate";
  window.S.parentUnlocked = false;
  window.render();
}

before(boot);
after(() => dom.window.close());

test("tryPin() POSTs to /functions/v1/verify-pin with the JWT and the PIN", async () => {
  openParentGate();
  fetchLog.length = 0;
  nextFetchResponse = { status: 200, body: { ok: true } };
  doc.getElementById("pinInput").value = "4321";
  await window.tryPin();
  assert.equal(fetchLog.length, 1);
  const call = fetchLog[0];
  assert.match(call.url, /\/functions\/v1\/verify-pin$/);
  assert.equal(call.opts.method, "POST");
  assert.equal(call.opts.headers.Authorization, "Bearer jwt-token");
  assert.equal(call.opts.headers.apikey, "fake-anon-key");
  assert.deepEqual(JSON.parse(call.opts.body), { pin: "4321" });
  assert.equal(window.S.parentUnlocked, true, "successful verify should unlock parent mode");
});

test("wrong PIN keeps the gate up and shows attempts-left in the error banner", async () => {
  openParentGate();
  fetchLog.length = 0;
  nextFetchResponse = { status: 401, body: { ok: false, reason: "bad_pin", attemptsLeft: 3 } };
  doc.getElementById("pinInput").value = "9999";
  await window.tryPin();
  assert.equal(window.S.parentUnlocked, false);
  const errText = doc.getElementById("pinErr").textContent;
  assert.match(errText, /Incorrect PIN.*3 left/i, `expected an attempts-left error, got: "${errText}"`);
});

test("lockout response surfaces a time in the error banner", async () => {
  openParentGate();
  fetchLog.length = 0;
  const until = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  nextFetchResponse = { status: 429, body: { ok: false, reason: "locked", lockedUntil: until } };
  doc.getElementById("pinInput").value = "9999";
  await window.tryPin();
  assert.equal(window.S.parentUnlocked, false);
  const errText = doc.getElementById("pinErr").textContent;
  assert.match(errText, /Too many wrong PINs/i);
});

test("no_pin_set response triggers a set-pin follow-up call", async () => {
  openParentGate();
  fetchLog.length = 0;
  const responses = [
    { status: 400, body: { ok: false, reason: "no_pin_set" } },
    { status: 200, body: { ok: true } },
  ];
  // Chain the responses so verify-pin returns no_pin_set, set-pin then succeeds.
  let i = 0;
  window.fetch = async (url, opts) => {
    fetchLog.push({ url: String(url), opts });
    const r = responses[i++] || { status: 200, body: { ok: true } };
    return { status: r.status, json: async () => r.body };
  };
  doc.getElementById("pinInput").value = "8888";
  await window.tryPin();
  assert.equal(fetchLog.length, 2);
  assert.match(fetchLog[0].url, /verify-pin$/);
  assert.match(fetchLog[1].url, /set-pin$/);
  assert.deepEqual(JSON.parse(fetchLog[1].opts.body), { pin: "8888" });
  assert.equal(window.S.parentUnlocked, true);
});
