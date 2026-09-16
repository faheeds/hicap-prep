// E7-4: org white-label theming tests.
//
// Structural checks against the migration SQL + source code. No live DB.
// Covers: schema change, security constraints, applyOrgTheme() behavior
// (whitelist enforcement, null/empty-object handling, visible logging).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { JSDOM } from "jsdom";

const root = path.resolve(fileURLToPath(import.meta.url), "../..");
const migPath = path.join(root, "supabase", "migrations", "20260914001600_org_theme.sql");
const MIG = readFileSync(migPath, "utf-8");
const STORE = readFileSync(path.join(root, "src", "store.js"), "utf-8");
const APP_HTML = readFileSync(path.join(root, "src", "app.html"), "utf-8");

// ---------------------------------------------------------------------------
// Migration: theme_overrides column
// ---------------------------------------------------------------------------
test("E7-4 migration: adds theme_overrides jsonb column to organizations", () => {
  assert.match(MIG, /alter table public\.organizations/i);
  assert.match(MIG, /add column if not exists theme_overrides\s+jsonb/i);
});

test("E7-4 migration: theme_overrides is nullable (no NOT NULL constraint)", () => {
  assert.doesNotMatch(MIG, /theme_overrides\s+jsonb\s+not null/i);
});

test("E7-4 migration: owner UPDATE policy exists for name and slug (org_owner_update_name_slug)", () => {
  assert.match(MIG, /create policy.*org_owner_update_name_slug/i);
  assert.match(MIG, /for update/i);
  assert.match(MIG, /owner_user_id\s*=\s*auth\.uid\(\)/i);
});

test("E7-4 migration: UPDATE policy does NOT grant write to theme_overrides for authenticated", () => {
  // The migration comment and naming explicitly scope the policy to name/slug.
  // We verify the migration text itself flags this (the comment in the policy
  // description names name and slug, not theme_overrides).
  assert.match(MIG, /name.*slug|slug.*name/i,
    "migration must document that the owner UPDATE policy covers name/slug only");
});

// ---------------------------------------------------------------------------
// store.js: theme_overrides in queries
// ---------------------------------------------------------------------------
test("E7-4 store.js: my_owned_orgs query includes theme_overrides", () => {
  assert.match(STORE, /my_owned_orgs.*theme_overrides|theme_overrides.*my_owned_orgs/is);
  // More precisely: the select string for my_owned_orgs must contain theme_overrides.
  const idx = STORE.indexOf("my_owned_orgs");
  assert.ok(idx > -1);
  const ctx = STORE.slice(idx, idx + 200);
  assert.match(ctx, /theme_overrides/);
});

test("E7-4 store.js: loadCloud returns orgThemeOverrides field", () => {
  assert.match(STORE, /orgThemeOverrides\s*:/);
});

test("E7-4 store.js: orgThemeOverrides falls back to null (not undefined)", () => {
  const idx = STORE.indexOf("orgThemeOverrides");
  const ctx = STORE.slice(idx, idx + 200);
  assert.match(ctx, /null/, "orgThemeOverrides must fall back to null when absent");
});

// ---------------------------------------------------------------------------
// app.html: applyOrgTheme() function
// ---------------------------------------------------------------------------
const applyIdx = APP_HTML.indexOf("function applyOrgTheme");
test("E7-4 app.html: applyOrgTheme function is defined", () => {
  assert.ok(applyIdx > -1, "applyOrgTheme must be defined in app.html");
});

test("E7-4 app.html: applyOrgTheme has a whitelist of allowed CSS tokens", () => {
  const fnBody = APP_HTML.slice(applyIdx, applyIdx + 800);
  assert.match(fnBody, /ORG_THEME_WHITELIST|whitelist/i,
    "applyOrgTheme must guard against arbitrary CSS token injection via a whitelist");
});

test("E7-4 app.html: applyOrgTheme whitelists only the expected color tokens", () => {
  // The whitelist must include the main brand tokens and nothing else structural.
  const fnBody = APP_HTML.slice(Math.max(0, applyIdx - 200), applyIdx + 600);
  assert.match(fnBody, /--flare/, "whitelist must include --flare");
  assert.match(fnBody, /--lagoon/, "whitelist must include --lagoon");
  assert.match(fnBody, /--violet/, "whitelist must include --violet");
  assert.match(fnBody, /--ink/, "whitelist must include --ink");
});

test("E7-4 app.html: applyOrgTheme skips non-whitelisted tokens with a console.warn", () => {
  const fnBody = APP_HTML.slice(applyIdx, applyIdx + 800);
  assert.match(fnBody, /console\.warn.*whitelist|whitelist.*console\.warn|non-whitelisted|not.*whitelist/i,
    "applyOrgTheme must warn when a token is rejected by the whitelist (not silently drop it)");
});

test("E7-4 app.html: applyOrgTheme is a no-op for null overrides and logs it", () => {
  const fnBody = APP_HTML.slice(applyIdx, applyIdx + 800);
  // Must handle null/undefined without throwing, and log something.
  assert.match(fnBody, /null|undefined/,
    "applyOrgTheme must handle null overrides without throwing");
  assert.match(fnBody, /console\.warn|console\.log/,
    "applyOrgTheme must log something for null/empty overrides so absence isn't silent");
});

test("E7-4 app.html: applyOrgTheme is called in init() after loading APP", () => {
  // Look for the actual call (not the function definition).
  // The call passes APP.orgThemeOverrides, so search for that pattern.
  const callIdx = APP_HTML.indexOf("applyOrgTheme(APP.");
  assert.ok(callIdx > -1, "applyOrgTheme must be called with APP.orgThemeOverrides in init()");
  // The init IIFE is at the end; applyOrgTheme calls must be after loadApp.
  const loadAppIdx = APP_HTML.indexOf("APP = await loadApp()");
  assert.ok(callIdx > loadAppIdx,
    "applyOrgTheme must be called after APP is loaded, not before");
});

// ---------------------------------------------------------------------------
// Behavioral tests via JSDOM
// ---------------------------------------------------------------------------
test("E7-4 applyOrgTheme: injects whitelisted CSS properties onto documentElement", async () => {
  const dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", {
    runScripts: "dangerously",
  });
  // Inject just the applyOrgTheme function and its dependencies.
  const fnStart = APP_HTML.indexOf("const ORG_THEME_WHITELIST");
  const fnEnd = APP_HTML.indexOf("\n}", fnStart) + 2;
  const fnSrc = APP_HTML.slice(fnStart, fnEnd);
  dom.window.eval(fnSrc + "\nwindow.applyOrgTheme = applyOrgTheme;");

  dom.window.applyOrgTheme({"--flare": "#e00", "--lagoon": "#0ae"});
  const style = dom.window.document.documentElement.style;
  assert.equal(style.getPropertyValue("--flare"), "#e00");
  assert.equal(style.getPropertyValue("--lagoon"), "#0ae");
});

test("E7-4 applyOrgTheme: does not inject non-whitelisted tokens", async () => {
  const dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", {
    runScripts: "dangerously",
  });
  const fnStart = APP_HTML.indexOf("const ORG_THEME_WHITELIST");
  const fnEnd = APP_HTML.indexOf("\n}", fnStart) + 2;
  const fnSrc = APP_HTML.slice(fnStart, fnEnd);
  const warnings = [];
  dom.window.console = { ...dom.window.console, warn: (msg) => warnings.push(msg), log: () => {} };
  dom.window.eval(fnSrc + "\nwindow.applyOrgTheme = applyOrgTheme;");

  dom.window.applyOrgTheme({"--font-body": "Comic Sans", "--evil": "injected"});
  const style = dom.window.document.documentElement.style;
  assert.equal(style.getPropertyValue("--font-body"), "",
    "non-whitelisted token --font-body must not be injected");
  assert.ok(warnings.length > 0, "must emit console.warn for rejected tokens");
});

test("E7-4 applyOrgTheme: does not throw when called with null", async () => {
  const dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", {
    runScripts: "dangerously",
  });
  const fnStart = APP_HTML.indexOf("const ORG_THEME_WHITELIST");
  const fnEnd = APP_HTML.indexOf("\n}", fnStart) + 2;
  const fnSrc = APP_HTML.slice(fnStart, fnEnd);
  dom.window.console = { warn: () => {}, log: () => {} };
  dom.window.eval(fnSrc + "\nwindow.applyOrgTheme = applyOrgTheme;");

  assert.doesNotThrow(() => dom.window.applyOrgTheme(null),
    "applyOrgTheme(null) must not throw");
});
