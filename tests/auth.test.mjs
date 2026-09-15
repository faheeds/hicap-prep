// Parent-account auth (Epic 1, E1-2).
//
// Boots src/app.html with a stubbed Supabase client so we can exercise the
// auth gate, sign-in, and sign-out flows without any network access. The
// stub is injected by pre-seeding window.__HICAP_CONFIG *before* the app's
// inline scripts run — the resource loader picks it up as if a real
// src/config.local.js were in place.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const HTML_PATH = new URL("../src/app.html", import.meta.url);

let dom, window, doc, fakeSupabase, authChangeCb;

function makeFakeSupabase() {
  let session = null;
  return {
    _setSession(s) { session = s; if (authChangeCb) authChangeCb("SIGNED_IN", s); },
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: (cb) => { authChangeCb = cb; return { data: { subscription: { unsubscribe(){} } } }; },
      signInWithPassword: async ({ email }) => {
        session = { user: { id: "u1", email }, access_token: "fake" };
        if (authChangeCb) authChangeCb("SIGNED_IN", session);
        return { data: { session, user: session.user }, error: null };
      },
      signUp: async ({ email }) => ({ data: { user: { id: "u1", email }, session: null }, error: null }),
      signInWithOtp: async () => ({ data: {}, error: null }),
      signOut: async () => {
        session = null;
        if (authChangeCb) authChangeCb("SIGNED_OUT", null);
        return { error: null };
      },
    },
  };
}

async function boot() {
  const html = readFileSync(HTML_PATH, "utf-8");
  dom = new JSDOM(html, {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    // Point the document URL at the actual file so <script src="..."> tags
    // resolve to real files in src/ instead of 404-ing against localhost.
    url: HTML_PATH.href,
    beforeParse(win) {
      // Config has to exist before supabase-client.js runs — otherwise
      // hicap.isCloud latches to false and the auth gate never activates.
      win.__HICAP_CONFIG = {
        supabaseUrl: "https://fake.supabase.co",
        supabaseAnonKey: "fake-anon-key",
      };
      fakeSupabase = makeFakeSupabase();
      // Escape hatch that supabase-client.js checks before hitting the CDN.
      win.__HICAP_TEST_CLIENT = fakeSupabase;
    },
  });
  window = dom.window;
  window.alert = () => { throw new Error("native alert blocked"); };
  window.confirm = () => { throw new Error("native confirm blocked"); };
  window.prompt = () => { throw new Error("native prompt blocked"); };
  // Give the browser time to fetch the external scripts (auth.js,
  // supabase-client.js) from disk, run the inline scripts, and finish
  // AUTH.init() before we start asserting on the DOM.
  await new Promise((r) => setTimeout(r, 800));
  doc = window.document;
}

before(boot);
after(() => dom.window.close());

test("cloud mode: needsAuthGate is true when no session exists", () => {
  assert.equal(window.__hicap.isCloud, true, "should have detected cloud config");
  assert.equal(window.needsAuthGate(), true, "no session should force the auth gate");
});

test("cloud mode: bodyHTML renders the sign-in screen, not the roster", () => {
  const body = doc.getElementById("app").innerHTML;
  assert.ok(body.includes("Sign in to HiCap Prep"), "expected sign-in title");
  assert.ok(!body.includes("Who's practicing today?"), "roster should not be visible");
});

test("cloud mode: signing in dismisses the gate and reveals the app", async () => {
  doc.getElementById("authEmail").value = "parent@example.com";
  doc.getElementById("authPassword").value = "hunter22ok";
  await window.authDoSignin();
  // The onAuthStateChange listener re-renders; give it a tick.
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(window.needsAuthGate(), false, "session should have been established");
  const body = doc.getElementById("app").innerHTML;
  assert.ok(body.includes("Who's practicing today?"), "roster should now be visible");
});

test("cloud mode: signing out re-shows the gate and clears local state", async () => {
  // Add a student first so we can verify sign-out clears the local mirror.
  window.S.addingStudent = true; window.render();
  doc.getElementById("newName").value = "Test Student";
  window.submitNewStudent();
  assert.equal(Object.keys(window.APP.students).length, 1);
  await window.authDoSignout();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(window.needsAuthGate(), true, "should be back at the auth gate");
  assert.equal(Object.keys(window.APP.students).length, 0, "APP should have been reset on sign-out");
});
