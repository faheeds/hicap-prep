// Account deletion (Epic 1, E1-7).
//
// Two paths to cover:
//   1. Cloud mode: parent triggers delete -> hits /functions/v1/delete-account
//      with the JWT -> on ok, sign out + reset local state.
//   2. Local mode: wipe the localStorage blob and reset in-memory state.
//
// This test focuses on the client-side wiring — the edge function itself
// is a thin wrapper around admin.auth.admin.deleteUser() and doesn't have
// a useful unit-test surface without a real Postgres.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const HTML_PATH = new URL("../src/app.html", import.meta.url);

const fetchLog = [];
let nextFetchResponse = { status: 200, body: { ok: true } };

function makeFakeSupabase() {
  const session = { user: { id: "u1", email: "p@example.com" }, access_token: "jwt-token" };
  return {
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }),
    },
    from() {
      const empty = { data: [], error: null };
      const maybe = { data: null, error: null };
      const chain = {
        select: () => chain, eq: () => chain, in: () => chain, order: () => chain, limit: () => chain,
        maybeSingle: () => Promise.resolve(maybe), single: () => Promise.resolve(maybe),
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
    runScripts: "dangerously", resources: "usable", pretendToBeVisual: true,
    url: HTML_PATH.href,
    beforeParse(win) {
      win.__HICAP_CONFIG = { supabaseUrl: "https://fake.supabase.co", supabaseAnonKey: "fake-anon-key" };
      win.__HICAP_TEST_CLIENT = makeFakeSupabase();
      win.fetch = async (url, opts) => {
        fetchLog.push({ url: String(url), opts });
        const r = nextFetchResponse;
        return { status: r.status, json: async () => r.body };
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

before(boot);
after(() => dom.window.close());

test("cloud mode: confirmDeleteAccount() -> confirm modal -> delete-account POST -> local reset", async () => {
  // Seed some in-memory state so we can verify it's wiped after delete.
  window.APP.students["stu-1"] = {
    id: "stu-1", name: "Fixture Kid", avatar: "🦊", color: "#3B6E5E",
    createdAt: new Date().toISOString(),
    history: [{ date: new Date().toISOString(), title: "test", kind: "practice", correct: 1, total: 1, bySub: {}, wrongQuestions: [] }],
    streak: { current: 1, longest: 1, lastDate: null }, badgesSeen: [],
  };
  window.CUR = "stu-1";
  fetchLog.length = 0;
  nextFetchResponse = { status: 200, body: { ok: true } };

  window.confirmDeleteAccount();
  // A confirm modal should be waiting for approval; approve it.
  assert.ok(window.MODAL && window.MODAL.mode === "confirm", "expected the in-app confirm modal");
  window.modalConfirmYes();
  await new Promise((r) => setTimeout(r, 40));

  const call = fetchLog.find((c) => /\/functions\/v1\/delete-account$/.test(c.url));
  assert.ok(call, "expected a POST to /functions/v1/delete-account");
  assert.equal(call.opts.method, "POST");
  assert.equal(call.opts.headers.Authorization, "Bearer jwt-token");

  assert.deepEqual(Object.keys(window.APP.students), [], "students should be cleared locally");
  assert.equal(window.CUR, null);
  assert.equal(window.S.parentUnlocked, false);
});
