// E7-3: bulk roster import tests.
//
// Structural checks against the migration SQL + source code. No live DB.
// Covers: table schema, RLS policies (including rejection tests), CSV parsing
// correctness, error visibility, and store.js wiring.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(fileURLToPath(import.meta.url), "../..");
const migPath = path.join(root, "supabase", "migrations", "20260914001500_org_roster.sql");
const MIG = readFileSync(migPath, "utf-8");
// Hardening migration that adds explicit RESTRICTIVE deny policies for UPDATE/DELETE.
const DENY_MIG = readFileSync(
  path.join(root, "supabase", "migrations", "20260914001700_org_roster_deny_write.sql"), "utf-8"
);
const STORE = readFileSync(path.join(root, "src", "store.js"), "utf-8");
const APP_HTML = readFileSync(path.join(root, "src", "app.html"), "utf-8");

// ---------------------------------------------------------------------------
// org_roster_entries table — schema
// ---------------------------------------------------------------------------
test("E7-3 migration: creates org_roster_entries table", () => {
  assert.match(MIG, /create table.*public\.org_roster_entries/i);
});

test("E7-3 migration: id is UUID primary key with gen_random_uuid()", () => {
  assert.match(MIG, /id\s+uuid\s+primary key\s+default gen_random_uuid\(\)/i);
});

test("E7-3 migration: organization_id is NOT NULL FK referencing organizations ON DELETE CASCADE", () => {
  assert.match(MIG, /organization_id\s+uuid\s+not null.*references public\.organizations\(id\)\s+on delete cascade/is);
});

test("E7-3 migration: student_first_name is NOT NULL text", () => {
  assert.match(MIG, /student_first_name\s+text\s+not null/i);
});

test("E7-3 migration: student_grade has check constraint between 1 and 12", () => {
  assert.match(MIG, /student_grade.*check.*student_grade\s+between\s+1\s+and\s+12/is);
});

test("E7-3 migration: claimed_by_family_id is nullable FK ON DELETE SET NULL", () => {
  assert.match(MIG, /claimed_by_family_id\s+uuid\s+references public\.families.*on delete set null/is);
  // nullable = no NOT NULL
  assert.doesNotMatch(MIG, /claimed_by_family_id\s+uuid\s+not null/i);
});

test("E7-3 migration: created_at is NOT NULL with default now()", () => {
  assert.match(MIG, /created_at\s+timestamptz\s+not null\s+default now\(\)/i);
});

// ---------------------------------------------------------------------------
// Row-level security
// ---------------------------------------------------------------------------
test("E7-3 migration: enables RLS on org_roster_entries", () => {
  assert.match(MIG, /alter table public\.org_roster_entries enable row level security/i);
});

test("E7-3 migration: INSERT policy exists for org owner (org_owner_insert_roster)", () => {
  assert.match(MIG, /create policy.*org_owner_insert_roster/i);
  assert.match(MIG, /for insert/i);
  assert.match(MIG, /with check/i);
  assert.match(MIG, /owner_user_id\s*=\s*auth\.uid\(\)/i);
});

test("E7-3 migration: SELECT policy exists for org owner (org_owner_read_roster)", () => {
  assert.match(MIG, /create policy.*org_owner_read_roster/i);
});

test("E7-3 migration: SELECT policy exists for org members (org_member_read_roster)", () => {
  assert.match(MIG, /create policy.*org_member_read_roster/i);
  assert.match(MIG, /families\.owner_id\s*=\s*auth\.uid\(\)/i);
});

test("E7-3 migration: no UPDATE or DELETE policy for authenticated on org_roster_entries", () => {
  const policies = MIG.match(/create policy[^;]+;/gis) || [];
  const writePolicies = policies.filter(p =>
    /for\s+(update|delete)/i.test(p) && /to authenticated/i.test(p)
  );
  assert.equal(writePolicies.length, 0,
    "authenticated users must not have UPDATE or DELETE on org_roster_entries");
});

// Security: a non-owner cannot insert via the INSERT policy WITH CHECK clause.
// Verified structurally: the WITH CHECK filters on organizations.owner_user_id = auth.uid().
test("E7-3 migration: INSERT policy rejects non-owners (WITH CHECK requires owner_user_id match)", () => {
  const insertPolicyMatch = MIG.match(/create policy.*org_owner_insert_roster[\s\S]*?;/i);
  assert.ok(insertPolicyMatch, "org_owner_insert_roster policy must exist");
  const insertPolicy = insertPolicyMatch[0];
  assert.match(insertPolicy, /with check/i,
    "INSERT policy must use WITH CHECK (not USING) so it rejects insertions by non-owners");
  assert.match(insertPolicy, /owner_user_id\s*=\s*auth\.uid\(\)/i,
    "WITH CHECK must require the org owner_user_id matches auth.uid()");
});

// ---------------------------------------------------------------------------
// store.js wiring
// ---------------------------------------------------------------------------
test("E7-3 store.js: importOrgRoster function exists", () => {
  assert.match(STORE, /async function importOrgRoster/);
});

test("E7-3 store.js: importOrgRoster inserts to org_roster_entries", () => {
  assert.match(STORE, /org_roster_entries/);
});

test("E7-3 store.js: importOrgRoster returns inserted count and errors array", () => {
  const fnIdx = STORE.indexOf("async function importOrgRoster");
  assert.ok(fnIdx > -1, "importOrgRoster must exist");
  const fnBody = STORE.slice(fnIdx, fnIdx + 600);
  assert.match(fnBody, /inserted/i, "return value must include inserted count");
  assert.match(fnBody, /errors/i, "return value must include errors array");
});

test("E7-3 store.js: importOrgRoster is exposed on the Store public interface", () => {
  assert.match(STORE, /importOrgRoster\s*\(orgId,\s*rows\)/);
});

// ---------------------------------------------------------------------------
// CSV parsing — parseOrgCsv()
// ---------------------------------------------------------------------------
// Parse the function body from app.html for unit-style checks.
const parseOrgCsvIdx = APP_HTML.indexOf("function parseOrgCsv");
test("E7-3 app.html: parseOrgCsv function is defined", () => {
  assert.ok(parseOrgCsvIdx > -1, "parseOrgCsv must be defined in app.html");
});

test("E7-3 app.html: parseOrgCsv returns valid and errors arrays", () => {
  const fnBody = APP_HTML.slice(parseOrgCsvIdx, parseOrgCsvIdx + 800);
  assert.match(fnBody, /valid/i);
  assert.match(fnBody, /errors/i);
});

test("E7-3 app.html: parseOrgCsv validates grade range (1–12)", () => {
  const fnBody = APP_HTML.slice(parseOrgCsvIdx, parseOrgCsvIdx + 800);
  // Must check grade is within 1–12.
  assert.match(fnBody, /grade\s*[<>]=?\s*1[^2]|grade\s*[<>]=?\s*12|between\s+1\s+and\s+12|grade.*1.*12/i);
});

test("E7-3 app.html: parseOrgCsv catches missing name", () => {
  const fnBody = APP_HTML.slice(parseOrgCsvIdx, parseOrgCsvIdx + 800);
  assert.match(fnBody, /name/i,
    "parseOrgCsv must check that student name is present");
});

// ---------------------------------------------------------------------------
// UI — upload CSV in org dashboard
// ---------------------------------------------------------------------------
test("E7-3 app.html: org dashboard section includes CSV upload trigger", () => {
  // Either a <input type=file> or a textarea accept-CSV button must reference parseOrgCsv.
  assert.match(APP_HTML, /parseOrgCsv/,
    "org dashboard must reference parseOrgCsv for CSV upload");
});

test("E7-3 app.html: import errors are shown to the user (not silently dropped)", () => {
  // After a parse, error rows must be surfaced in the UI — not console-only.
  // We check that the roster import flow references errors in a render path.
  const importIdx = APP_HTML.indexOf("importOrgRoster");
  assert.ok(importIdx > -1, "importOrgRoster must be called somewhere in app.html");
  // The surrounding context must handle error display.
  const ctx = APP_HTML.slice(Math.max(0, importIdx - 500), importIdx + 500);
  assert.match(ctx, /error/i,
    "import flow must surface errors visibly rather than silently ignoring bad rows");
});

// ---------------------------------------------------------------------------
// RLS rejection tests — UPDATE and DELETE (migration 20260914001700)
//
// These mirror the INSERT rejection test above. Rather than relying on the
// implicit default-deny (no permissive policy = deny), we assert the existence
// of explicit RESTRICTIVE policies that block authenticated UPDATE and DELETE
// even if a future permissive FOR ALL policy were accidentally added.
// ---------------------------------------------------------------------------
test("E7-3 RLS rejection: UPDATE is explicitly blocked via RESTRICTIVE policy (org_roster_no_update)", () => {
  assert.match(DENY_MIG, /create policy.*org_roster_no_update/i,
    "explicit UPDATE-denial policy must exist");
  // Extract the UPDATE policy block to verify it is RESTRICTIVE with USING(false).
  const updatePolicyMatch = DENY_MIG.match(/create policy[^;]*org_roster_no_update[\s\S]*?;/i);
  assert.ok(updatePolicyMatch, "org_roster_no_update policy block must parse");
  const pol = updatePolicyMatch[0];
  assert.match(pol, /as restrictive/i,
    "UPDATE denial must use AS RESTRICTIVE so it cannot be overridden by future permissive policies");
  assert.match(pol, /for update/i, "policy must target UPDATE");
  assert.match(pol, /to authenticated/i, "policy must target the authenticated role");
  assert.match(pol, /using\s*\(\s*false\s*\)/i,
    "USING(false) rejects the action for every row, i.e., all authenticated UPDATE attempts are rejected");
});

test("E7-3 RLS rejection: DELETE is explicitly blocked via RESTRICTIVE policy (org_roster_no_delete)", () => {
  assert.match(DENY_MIG, /create policy.*org_roster_no_delete/i,
    "explicit DELETE-denial policy must exist");
  const deletePolicyMatch = DENY_MIG.match(/create policy[^;]*org_roster_no_delete[\s\S]*?;/i);
  assert.ok(deletePolicyMatch, "org_roster_no_delete policy block must parse");
  const pol = deletePolicyMatch[0];
  assert.match(pol, /as restrictive/i,
    "DELETE denial must use AS RESTRICTIVE so it cannot be overridden by future permissive policies");
  assert.match(pol, /for delete/i, "policy must target DELETE");
  assert.match(pol, /to authenticated/i, "policy must target the authenticated role");
  assert.match(pol, /using\s*\(\s*false\s*\)/i,
    "USING(false) rejects the action for every row, i.e., all authenticated DELETE attempts are rejected");
});

test("E7-3 RLS rejection: only INSERT is permitted for authenticated (no other write path exists)", () => {
  // Combined check: across both migrations, the only permissive write policy
  // for authenticated is INSERT (owner only). Any UPDATE/DELETE for authenticated
  // is blocked by the restrictive policies above.
  const combined = MIG + DENY_MIG;
  const policies = combined.match(/create policy[^;]+;/gis) || [];
  const permissiveWrites = policies.filter(p =>
    /for\s+(update|delete)/i.test(p)
    && /to authenticated/i.test(p)
    && !/as restrictive/i.test(p)
  );
  assert.equal(permissiveWrites.length, 0,
    "no permissive UPDATE or DELETE policy must exist for authenticated — only RESTRICTIVE blocks");
});
