// Email reminder opt-in (Epic 4, E4-4).
//
// The email toggle and Store.saveEmailPreference are the testable parts on the
// client side. The edge function (send-digest) is Deno/server-side and can't
// run in jsdom — we verify the Store stub path and the UI toggle here.

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

before(async () => { await boot(); });
after(() => dom.window.close());

test("Store.saveEmailPreference is exposed", () => {
  const store = window.__hicap && window.__hicap.Store;
  assert.ok(store, "Store should be defined");
  assert.equal(typeof store.saveEmailPreference, "function", "saveEmailPreference should be a function");
});

test("toggleEmailReminders is defined on the window", () => {
  assert.equal(typeof window.toggleEmailReminders, "function");
});

test("emailReminderToggleHTML is defined on the window", () => {
  assert.equal(typeof window.emailReminderToggleHTML, "function");
});

test("emailReminderToggleHTML returns HTML with the opt-in button", () => {
  const html = window.emailReminderToggleHTML();
  assert.ok(typeof html === "string" && html.length > 0, "should return non-empty string");
  assert.ok(html.includes("toggleEmailReminders"), "should wire up toggleEmailReminders");
  assert.ok(html.includes("Weekly reminders"), "should mention weekly reminders");
});

test("emailReminderToggleHTML shows OFF when APP.emailRemindersOptedIn is false", () => {
  window.APP.emailRemindersOptedIn = false;
  const html = window.emailReminderToggleHTML();
  assert.ok(html.includes("OFF"), "should show OFF state");
});

test("emailReminderToggleHTML shows ON when APP.emailRemindersOptedIn is true", () => {
  window.APP.emailRemindersOptedIn = true;
  const html = window.emailReminderToggleHTML();
  assert.ok(html.includes("ON"), "should show ON state");
  window.APP.emailRemindersOptedIn = false; // reset
});

test("Store.saveEmailPreference (local mode) updates APP.emailRemindersOptedIn", async () => {
  const store = window.__hicap.Store;
  // In local mode (no Supabase), saveEmailPreference just writes the value.
  await store.saveEmailPreference(window.APP, true);
  assert.equal(window.APP.emailRemindersOptedIn, true, "should toggle to true");
  await store.saveEmailPreference(window.APP, false);
  assert.equal(window.APP.emailRemindersOptedIn, false, "should toggle back to false");
});

test("schema migration 20260914000700 adds the expected columns", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/20260914000700_email_reminders.sql", import.meta.url),
    "utf-8"
  );
  assert.ok(sql.includes("email_reminders_opted_in"), "migration must add email_reminders_opted_in");
  assert.ok(sql.includes("retention_email_sent_at"), "migration must add retention_email_sent_at");
});
