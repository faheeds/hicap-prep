// E6-1: admin-metrics live integration test.
//
// Creates deterministic fixture rows, calls the live admin-metrics Edge Function,
// asserts the returned counts match the fixtures exactly (delta from baseline),
// then deletes every synthetic row so nothing lingers in prod.
//
// Required environment variables (skip test if any are absent):
//   SUPABASE_URL              https://yugphmivebozmeciyixw.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  service-role JWT (from supabase projects api-keys)
//   ADMIN_SECRET               the ADMIN_SECRET set in the project's Supabase secrets
//
// Run:   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ADMIN_SECRET=... npm test
// Or:    source .env.test && npm test   (if you have a local .env.test with these vars)

import { test, before, after } from "node:test";
import assert from "node:assert/strict";

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_SECRET     = process.env.ADMIN_SECRET;
const FUNCTION_URL     = SUPABASE_URL
  ? `${SUPABASE_URL}/functions/v1/admin-metrics`
  : null;

const SKIP = !SUPABASE_URL || !SERVICE_ROLE_KEY || !ADMIN_SECRET;
const SKIP_REASON = "admin integration tests require SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and ADMIN_SECRET env vars";

// ---------------------------------------------------------------------------
// Supabase REST helpers (raw fetch, no additional dependencies)
// ---------------------------------------------------------------------------
function supaHeaders(extra = {}) {
  return {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=representation",
    ...extra,
  };
}

async function supaInsert(table, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: supaHeaders(),
    body: JSON.stringify(Array.isArray(rows) ? rows : [rows]),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`INSERT into ${table} failed (${res.status}): ${body}`);
  }
  return res.json();
}

async function supaDelete(table, ids) {
  // Delete by id using the `in` filter.
  const idList = ids.join(",");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=in.(${idList})`, {
    method: "DELETE",
    headers: supaHeaders({ "Prefer": "return=minimal" }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.warn(`DELETE from ${table} cleanup failed (${res.status}): ${body}`);
  }
}

async function createAuthUser(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: supaHeaders(),
    body: JSON.stringify({ email, password: "fixture-password-99!", email_confirm: true }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Auth user creation failed (${res.status}): ${body}`);
  }
  const { id } = await res.json();
  return id;
}

async function deleteAuthUser(userId) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: supaHeaders({ "Prefer": "return=minimal" }),
  });
  if (!res.ok) console.warn(`Auth user deletion failed for ${userId}: ${res.status}`);
}

async function callAdminMetrics() {
  const res = await fetch(FUNCTION_URL, {
    headers: { "Authorization": `Bearer ${ADMIN_SECRET}` },
  });
  if (!res.ok) throw new Error(`admin-metrics returned ${res.status}: ${await res.text()}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Fixture state (shared across before/after hooks)
// ---------------------------------------------------------------------------
let baseline;
let authUserIds  = [];  // created auth.users rows
let familyIds    = [];  // created families rows
let studentIds   = [];  // created students rows
let attemptIds   = [];  // created attempts rows

// Fixture design — deterministic, chosen to give unambiguous deltas:
//   2 families: 1 paid (family_annual), 1 free
//   1 student per family (2 total)
//   attempts: 3 practice, 2 program, 1 mock  (6 total)
//   All created_at set to a fixed past timestamp so signupsLast7 and
//   signupsLast30 counts can be asserted predictably.
const FIXTURE_DATE_OLD = "2020-01-01T00:00:00.000Z"; // outside last-7 and last-30 windows
const FIXTURE_TAG      = "admin-integration-test";

// ---------------------------------------------------------------------------
before(async () => {
  if (SKIP) return;

  // Read baseline counts before inserting anything.
  baseline = await callAdminMetrics();

  // Create 2 auth users with clearly synthetic emails.
  const uid1 = await createAuthUser(`fixture-paid-${Date.now()}@hicap-test.invalid`);
  const uid2 = await createAuthUser(`fixture-free-${Date.now()}@hicap-test.invalid`);
  authUserIds = [uid1, uid2];

  // Insert 2 families. Family 1 is paid, family 2 is free.
  // Use FIXTURE_DATE_OLD so signupsLast7/30 deltas are zero.
  const families = await supaInsert("families", [
    {
      owner_id: uid1, parent_pin_hash: null,
      pass_type: "family_annual", pass_expires_at: "2099-01-01T00:00:00Z",
      email_reminders_opted_in: false,
      created_at: FIXTURE_DATE_OLD,
    },
    {
      owner_id: uid2, parent_pin_hash: null,
      pass_type: "free", pass_expires_at: null,
      email_reminders_opted_in: false,
      created_at: FIXTURE_DATE_OLD,
    },
  ]);
  familyIds = families.map(f => f.id);

  // Insert 1 student per family (2 total).
  const students = await supaInsert("students", [
    { family_id: familyIds[0], name: `${FIXTURE_TAG}-student-1`, avatar: "🐶", color: "#ccc", grade: 7 },
    { family_id: familyIds[1], name: `${FIXTURE_TAG}-student-2`, avatar: "🐱", color: "#eee", grade: 7 },
  ]);
  studentIds = students.map(s => s.id);

  // Insert 6 attempts with known kinds (3 practice, 2 program, 1 mock).
  const now = new Date().toISOString();
  const attempts = await supaInsert("attempts", [
    { family_id: familyIds[0], student_id: studentIds[0], taken_at: now, kind: "practice", correct: 18, total: 20, title: `${FIXTURE_TAG}-1` },
    { family_id: familyIds[0], student_id: studentIds[0], taken_at: now, kind: "practice", correct: 17, total: 20, title: `${FIXTURE_TAG}-2` },
    { family_id: familyIds[1], student_id: studentIds[1], taken_at: now, kind: "practice", correct: 16, total: 20, title: `${FIXTURE_TAG}-3` },
    { family_id: familyIds[0], student_id: studentIds[0], taken_at: now, kind: "program",  correct: 8,  total: 10, title: `${FIXTURE_TAG}-4` },
    { family_id: familyIds[1], student_id: studentIds[1], taken_at: now, kind: "program",  correct: 7,  total: 10, title: `${FIXTURE_TAG}-5` },
    { family_id: familyIds[0], student_id: studentIds[0], taken_at: now, kind: "mock",     correct: 38, total: 45, title: `${FIXTURE_TAG}-6` },
  ]);
  attemptIds = attempts.map(a => a.id);
});

after(async () => {
  if (SKIP) return;
  // Delete in reverse FK order: attempts → students → families → auth users.
  if (attemptIds.length)  await supaDelete("attempts", attemptIds);
  if (studentIds.length)  await supaDelete("students", studentIds);
  if (familyIds.length)   await supaDelete("families", familyIds);
  for (const uid of authUserIds) await deleteAuthUser(uid);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
test("admin-metrics: skip if env vars absent", { skip: SKIP ? SKIP_REASON : false }, () => {});

test("admin-metrics: returned JSON has the expected top-level shape", { skip: SKIP ? SKIP_REASON : false }, async () => {
  const data = await callAdminMetrics();
  assert.ok(data.generatedAt, "generatedAt must be present");
  assert.ok(typeof data.families === "object", "families object must be present");
  assert.ok(typeof data.students === "object", "students object must be present");
  assert.ok(typeof data.attempts === "object", "attempts object must be present");
  assert.ok("total" in data.families,           "families.total must be present");
  assert.ok("paid" in data.families,            "families.paid must be present");
  assert.ok("conversionPct" in data.families,   "families.conversionPct must be present");
  assert.ok("signupsLast7Days" in data.families,"families.signupsLast7Days must be present");
  assert.ok("practice" in data.attempts,        "attempts.practice must be present");
  assert.ok("program" in data.attempts,         "attempts.program must be present");
  assert.ok("mock" in data.attempts,            "attempts.mock must be present");
});

test("admin-metrics: fixture families appear in totals (delta = 2)", { skip: SKIP ? SKIP_REASON : false }, async () => {
  const data = await callAdminMetrics();
  assert.equal(
    data.families.total,
    baseline.families.total + 2,
    `families.total should be baseline (${baseline.families.total}) + 2 fixture families`
  );
});

test("admin-metrics: fixture paid family counted in paid total (delta = 1)", { skip: SKIP ? SKIP_REASON : false }, async () => {
  const data = await callAdminMetrics();
  assert.equal(
    data.families.paid,
    baseline.families.paid + 1,
    `families.paid should be baseline (${baseline.families.paid}) + 1 paid fixture`
  );
});

test("admin-metrics: fixture free family counted in free total (delta = 1)", { skip: SKIP ? SKIP_REASON : false }, async () => {
  const data = await callAdminMetrics();
  assert.equal(
    data.families.free,
    baseline.families.free + 1,
    `families.free should be baseline (${baseline.families.free}) + 1 free fixture`
  );
});

test("admin-metrics: fixture students appear in student total (delta = 2)", { skip: SKIP ? SKIP_REASON : false }, async () => {
  const data = await callAdminMetrics();
  assert.equal(
    data.students.total,
    baseline.students.total + 2,
    `students.total should be baseline (${baseline.students.total}) + 2 fixture students`
  );
});

test("admin-metrics: fixture attempts appear in attempt totals (delta = 6 total, 3 practice, 2 program, 1 mock)", { skip: SKIP ? SKIP_REASON : false }, async () => {
  const data = await callAdminMetrics();
  assert.equal(data.attempts.total,    baseline.attempts.total    + 6, "total attempts delta = 6");
  assert.equal(data.attempts.practice, baseline.attempts.practice + 3, "practice attempts delta = 3");
  assert.equal(data.attempts.program,  baseline.attempts.program  + 2, "program attempts delta = 2");
  assert.equal(data.attempts.mock,     baseline.attempts.mock     + 1, "mock attempts delta = 1");
});

test("admin-metrics: fixture families (created 2020) do NOT appear in last-7/30 day signup counts", { skip: SKIP ? SKIP_REASON : false }, async () => {
  const data = await callAdminMetrics();
  assert.equal(
    data.families.signupsLast7Days,
    baseline.families.signupsLast7Days,
    "signupsLast7Days must not change — fixtures use a 2020 created_at"
  );
  assert.equal(
    data.families.signupsLast30Days,
    baseline.families.signupsLast30Days,
    "signupsLast30Days must not change — fixtures use a 2020 created_at"
  );
});

test("admin-metrics: unauthorized request returns 401", { skip: SKIP ? SKIP_REASON : false }, async () => {
  const res = await fetch(FUNCTION_URL, {
    headers: { "Authorization": "Bearer wrong-secret" },
  });
  assert.equal(res.status, 401, "wrong ADMIN_SECRET must return 401");
});

test("admin-metrics: missing Authorization header returns 401", { skip: SKIP ? SKIP_REASON : false }, async () => {
  const res = await fetch(FUNCTION_URL);
  assert.equal(res.status, 401, "missing Authorization must return 401");
});
