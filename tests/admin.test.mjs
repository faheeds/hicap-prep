// E6-1: Founder funnel dashboard — admin-metrics edge function tests.
//
// We don't have a live Supabase DB in CI, so these are structural tests:
//   1. The function exists and is structurally correct.
//   2. The authorization guard rejects requests without the secret.
//   3. The expected metric keys are present in the response shape.
//
// The behavioral correctness of the DB queries (actual counts) is verified
// by manual inspection against the hosted DB after the function is deployed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FN_SRC = readFileSync(
  new URL("../supabase/functions/admin-metrics/index.ts", import.meta.url),
  "utf-8"
);

const ADMIN_HTML = readFileSync(
  new URL("../src/admin.html", import.meta.url),
  "utf-8"
);

// ---------------------------------------------------------------------------
// Edge function structure
// ---------------------------------------------------------------------------

test("admin-metrics: function exists and uses Deno.serve", () => {
  assert.ok(FN_SRC.includes("Deno.serve"), "function must use Deno.serve");
});

test("admin-metrics: reads ADMIN_SECRET from env", () => {
  assert.ok(FN_SRC.includes("ADMIN_SECRET"), "function must read ADMIN_SECRET from env");
});

test("admin-metrics: unauthorized request returns 401", () => {
  assert.ok(FN_SRC.includes("status: 401"), "function must return 401 for bad token");
  assert.ok(
    FN_SRC.includes(`auth !== \`Bearer \${ADMIN_SECRET}\``),
    "function must compare Authorization header against the secret"
  );
});

test("admin-metrics: queries families, students, and attempts tables", () => {
  assert.ok(FN_SRC.includes('"families"'), "must query families table");
  assert.ok(FN_SRC.includes('"students"'), "must query students table");
  assert.ok(FN_SRC.includes('"attempts"'), "must query attempts table");
});

test("admin-metrics: response shape includes funnel metrics", () => {
  assert.ok(FN_SRC.includes("conversionPct"), "must include conversionPct");
  assert.ok(FN_SRC.includes("signupsLast7Days"), "must include signupsLast7Days");
  assert.ok(FN_SRC.includes("signupsLast30Days"), "must include signupsLast30Days");
  assert.ok(FN_SRC.includes("paid"), "must include paid count");
});

test("admin-metrics: response shape includes attempt breakdown", () => {
  assert.ok(FN_SRC.includes('"practice"'), "must include practice kind filter");
  assert.ok(FN_SRC.includes('"program"'),  "must include program kind filter");
  assert.ok(FN_SRC.includes('"mock"'),     "must include mock kind filter");
});

test("admin-metrics: handles OPTIONS preflight for CORS", () => {
  assert.ok(FN_SRC.includes("OPTIONS"), "must handle OPTIONS preflight");
  assert.ok(FN_SRC.includes("Access-Control-Allow-Origin"), "must set CORS headers");
});

// ---------------------------------------------------------------------------
// Admin dashboard HTML
// ---------------------------------------------------------------------------

test("admin.html: exists and loads metrics via fetch", () => {
  assert.ok(ADMIN_HTML.includes("fetch"), "admin.html must fetch metrics from the function");
  assert.ok(ADMIN_HTML.includes("Bearer"), "admin.html must send Authorization: Bearer token");
});

test("admin.html: shows all funnel metric cards", () => {
  assert.ok(ADMIN_HTML.includes("Total families"),  "must show Total families card");
  assert.ok(ADMIN_HTML.includes("Paid families"),   "must show Paid families card");
  assert.ok(ADMIN_HTML.includes("conversionPct"),   "must display conversion rate");
});

test("admin.html: has password-type input to avoid token appearing in autocomplete", () => {
  assert.ok(ADMIN_HTML.includes('type="password"'), "token input must be type=password");
});

test("admin.html: supports ?token= query param for bookmarking", () => {
  assert.ok(ADMIN_HTML.includes("URLSearchParams"), "must support ?token= for quick access");
});

test("admin.html: includes the trademark disclaimer", () => {
  assert.ok(ADMIN_HTML.toLowerCase().includes("not affiliated"),
    "admin.html must include the trademark disclaimer");
});
