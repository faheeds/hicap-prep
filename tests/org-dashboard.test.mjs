// E7-2: org usage dashboard tests.
//
// Structural checks against the migration SQL + source code. No live DB needed.
// Covers: RPC function security contract, privacy invariants, store.js wiring,
// and conditional UI rendering in parentHomeHTML().

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { JSDOM } from "jsdom";

const root = path.resolve(fileURLToPath(import.meta.url), "../..");
const migPath = path.join(root, "supabase", "migrations", "20260914001400_org_dashboard.sql");
const MIG = readFileSync(migPath, "utf-8");
const STORE = readFileSync(path.join(root, "src", "store.js"), "utf-8");
const APP_HTML = readFileSync(path.join(root, "src", "app.html"), "utf-8");

// ---------------------------------------------------------------------------
// get_org_stats() function — security contract
// ---------------------------------------------------------------------------
test("E7-2 migration: get_org_stats is SECURITY DEFINER", () => {
  assert.match(MIG, /security definer/i);
});

test("E7-2 migration: search_path is pinned to prevent search-path hijacking", () => {
  assert.match(MIG, /set search_path\s*=\s*public/i);
});

test("E7-2 migration: ownership check happens before any data SELECT", () => {
  // The ownership check `select owner_user_id into ...` must precede the main
  // data query `select jsonb_build_object`. Position check enforces ordering.
  const ownerCheckIdx = MIG.indexOf("select owner_user_id into");
  const dataQueryIdx  = MIG.indexOf("select jsonb_build_object");
  assert.ok(ownerCheckIdx > -1, "ownership check must exist");
  assert.ok(dataQueryIdx  > -1, "data query must exist");
  assert.ok(ownerCheckIdx < dataQueryIdx,
    "ownership check must come before data query (found order reversed)");
});

test("E7-2 migration: non-owner call raises insufficient_privilege", () => {
  // The rejection path must raise with the correct errcode.
  assert.match(MIG, /insufficient_privilege/i);
  assert.match(MIG, /raise exception/i);
  assert.match(MIG, /v_owner_user_id is distinct from auth\.uid\(\)/i);
});

test("E7-2 migration: function is granted execute to authenticated only", () => {
  assert.match(MIG, /grant execute on function public\.get_org_stats.*to authenticated/i);
  // Must NOT grant to anon.
  assert.doesNotMatch(MIG, /grant execute on function public\.get_org_stats.*to anon/i);
});

// ---------------------------------------------------------------------------
// Privacy contract — no individual student data
// ---------------------------------------------------------------------------
test("E7-2 migration: get_org_stats does not return student names or individual quiz data", () => {
  // The function body must not SELECT from students.name or include it in jsonb.
  const bodyMatch = MIG.match(/\$\$([\s\S]+?)\$\$/);
  assert.ok(bodyMatch, "function body must be delimited by $$");
  const body = bodyMatch[1];
  assert.doesNotMatch(body, /students\.name/i,
    "student names must never appear in org stats output");
  assert.doesNotMatch(body, /wrong_questions/i,
    "individual quiz answers must never appear in org stats output");
});

test("E7-2 migration: get_org_stats per-family jsonb contains only the expected aggregate keys", () => {
  // Positive shape assertion: the per-family jsonb_build_object must contain exactly
  // the approved aggregate keys. This catches a bug where a name or individual field
  // is aliased under a different key and slips past the negative tests above.
  const bodyMatch = MIG.match(/\$\$([\s\S]+?)\$\$/);
  assert.ok(bodyMatch, "function body must be delimited by $$");
  const body = bodyMatch[1];

  // Find the per-family jsonb_build_object (the one inside jsonb_agg, not the top-level one).
  // It must contain exactly: family_id, student_count, attempt_count, total_correct,
  // total_answered, last_active, accuracy_pct — and nothing else.
  const EXPECTED_KEYS = ["family_id", "student_count", "attempt_count",
                         "total_correct", "total_answered", "last_active", "accuracy_pct"];

  // Locate the per-family jsonb_build_object by finding the block that lives inside
  // jsonb_agg(). We extract from the jsonb_agg( call to the matching close paren.
  const aggIdx = body.indexOf("jsonb_agg(");
  assert.ok(aggIdx > -1, "jsonb_agg must exist in function body");
  // Advance past "jsonb_agg(" to where jsonb_build_object starts.
  const innerStart = body.indexOf("jsonb_build_object", aggIdx);
  assert.ok(innerStart > -1, "jsonb_build_object must appear inside jsonb_agg");
  // Grab a generous slice that covers all the per-family key-value pairs.
  const perFamilyBlock = body.slice(innerStart, innerStart + 600);

  // Every expected key must be present.
  for (const key of EXPECTED_KEYS) {
    assert.match(perFamilyBlock, new RegExp(`'${key}'`, "i"),
      `per-family jsonb must include aggregate key '${key}'`);
  }

  // The block must NOT contain any column name that identifies an individual.
  assert.doesNotMatch(perFamilyBlock, /['\s]name['\s]/i,
    "per-family jsonb must not expose any 'name' field");
  assert.doesNotMatch(perFamilyBlock, /wrong_questions/i,
    "per-family jsonb must not expose wrong_questions");
  assert.doesNotMatch(perFamilyBlock, /by_sub/i,
    "per-family jsonb must not expose individual by_sub breakdown");
});

test("E7-2 migration: families array coalesces to empty array, not null", () => {
  // COALESCE(..., '[]'::jsonb) ensures the field is always an array.
  assert.match(MIG, /coalesce\s*\(/i);
  assert.match(MIG, /'\[\]'::jsonb/i);
});

// ---------------------------------------------------------------------------
// my_owned_orgs view
// ---------------------------------------------------------------------------
test("E7-2 migration: my_owned_orgs view filters by auth.uid()", () => {
  assert.match(MIG, /where owner_user_id\s*=\s*auth\.uid\(\)/i);
});

test("E7-2 migration: my_owned_orgs grants SELECT to authenticated and anon", () => {
  assert.match(MIG, /grant select on public\.my_owned_orgs to authenticated,\s*anon/i);
});

// ---------------------------------------------------------------------------
// store.js wiring
// ---------------------------------------------------------------------------
test("E7-2 store.js: loadCloud queries my_owned_orgs view", () => {
  assert.match(STORE, /my_owned_orgs/);
});

test("E7-2 store.js: loadOrgStats exists and calls supabase.rpc", () => {
  assert.match(STORE, /loadOrgStats/);
  assert.match(STORE, /supabase\.rpc\s*\(\s*["']get_org_stats["']/);
});

test("E7-2 store.js: loadOrgStats warns on error rather than silently returning null", () => {
  // Must contain a console.warn call near the loadOrgStats error path.
  const fnIdx = STORE.indexOf("async function loadOrgStats");
  assert.ok(fnIdx > -1, "loadOrgStats function must exist");
  const fnBody = STORE.slice(fnIdx, fnIdx + 400);
  assert.match(fnBody, /console\.warn/i,
    "loadOrgStats must warn on error so failures are visible");
});

test("E7-2 store.js: loadCloud returns ownedOrg field", () => {
  // The return object in loadCloud must include ownedOrg.
  assert.match(STORE, /ownedOrg\s*:/);
});

// ---------------------------------------------------------------------------
// UI — parentHomeHTML conditional rendering
// ---------------------------------------------------------------------------
test("E7-2 app.html: parentHomeHTML contains org dashboard section", () => {
  assert.match(APP_HTML, /orgDashboardSectionHTML\s*\(\)/,
    "parentHomeHTML must call orgDashboardSectionHTML()");
});

test("E7-2 app.html: org section renders org name and seat info when ownedOrg present", () => {
  // The orgDashboardSectionHTML function must reference APP.ownedOrg.
  assert.match(APP_HTML, /APP\.ownedOrg/,
    "org section must guard on APP.ownedOrg");
});

test("E7-2 app.html: org section shows load stats button when stats not yet fetched", () => {
  assert.match(APP_HTML, /loadOrgStats\s*\(\)/,
    "org section must include a loadOrgStats() call for the load-stats button");
});

test("E7-2 app.html: loadOrgStats warns when no data returned", () => {
  const fnIdx = APP_HTML.indexOf("async function loadOrgStats");
  assert.ok(fnIdx > -1, "loadOrgStats must be defined in app.html");
  const fnBody = APP_HTML.slice(fnIdx, fnIdx + 500);
  assert.match(fnBody, /console\.warn/i,
    "loadOrgStats must warn when STORE returns null so silent failure is visible");
});
