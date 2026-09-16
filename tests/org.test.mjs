// E7-1: org/seat account model tests.
//
// Structural checks against the migration SQL only — no live DB connection.
// Tests verify shape, constraints, RLS policies, and the trigger guard rather
// than executing queries, following the pattern in tests/schema.test.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(fileURLToPath(import.meta.url), "../..");
const migPath = path.join(root, "supabase", "migrations", "20260914001300_org_accounts.sql");
const MIG = readFileSync(migPath, "utf-8");

// Also read the families initial schema to verify it doesn't already have
// organization_id (proving the column is genuinely new in this migration).
const initPath = path.join(root, "supabase", "migrations", "20260914000000_initial_schema.sql");
const INIT = readFileSync(initPath, "utf-8");

// ---------------------------------------------------------------------------
// organizations table — existence and column checks
// ---------------------------------------------------------------------------
test("migration 20260914001300: creates the organizations table", () => {
  assert.match(MIG, /create table.*public\.organizations/i);
});

test("migration 20260914001300: organizations.id is a UUID primary key with gen_random_uuid() default", () => {
  assert.match(MIG, /id\s+uuid\s+primary key\s+default gen_random_uuid\(\)/i);
});

test("migration 20260914001300: organizations.name is NOT NULL text", () => {
  assert.match(MIG, /name\s+text\s+not null/i);
});

test("migration 20260914001300: organizations.slug is UNIQUE and nullable", () => {
  assert.match(MIG, /slug\s+text\s+unique/i);
  // nullable = no NOT NULL constraint on slug
  assert.doesNotMatch(MIG, /slug\s+text\s+not null/i);
});

test("migration 20260914001300: organizations.seat_count is NOT NULL integer with CHECK >= 0", () => {
  assert.match(MIG, /seat_count\s+integer\s+not null/i);
  assert.match(MIG, /check\s*\(seat_count\s*>=\s*0\)/i);
});

test("migration 20260914001300: organizations.seat_expires_at is nullable timestamptz", () => {
  assert.match(MIG, /seat_expires_at\s+timestamptz/i);
  assert.doesNotMatch(MIG, /seat_expires_at\s+timestamptz\s+not null/i);
});

test("migration 20260914001300: organizations.owner_user_id references auth.users with ON DELETE SET NULL", () => {
  assert.match(MIG, /owner_user_id.*references auth\.users.*on delete set null/is);
});

test("migration 20260914001300: organizations.created_at is NOT NULL with default now()", () => {
  assert.match(MIG, /created_at\s+timestamptz\s+not null\s+default now\(\)/i);
});

// ---------------------------------------------------------------------------
// families.organization_id FK column
// ---------------------------------------------------------------------------
test("migration 20260914001300: adds organization_id column to families", () => {
  assert.match(MIG, /alter table public\.families\s+add column if not exists organization_id/i);
});

test("migration 20260914001300: organization_id references organizations with ON DELETE SET NULL", () => {
  assert.match(MIG, /organization_id\s+uuid\s+references public\.organizations.*on delete set null/is);
});

test("migration 20260914001300: creates a partial index on families.organization_id", () => {
  assert.match(MIG, /create index.*families_organization_id_idx/i);
  assert.match(MIG, /where organization_id is not null/i);
});

test("initial schema does NOT already have organization_id (column is genuinely new)", () => {
  assert.doesNotMatch(INIT, /organization_id/i);
});

// ---------------------------------------------------------------------------
// Row-level security
// ---------------------------------------------------------------------------
test("migration 20260914001300: enables RLS on organizations", () => {
  assert.match(MIG, /alter table public\.organizations enable row level security/i);
});

test("migration 20260914001300: org_members_read_own_org SELECT policy exists", () => {
  assert.match(MIG, /create policy.*org_members_read_own_org/i);
  assert.match(MIG, /for select/i);
  assert.match(MIG, /to authenticated/i);
  // policy filters by both organization_id match AND auth.uid()
  assert.match(MIG, /families\.organization_id\s*=\s*organizations\.id/i);
  assert.match(MIG, /families\.owner_id\s*=\s*auth\.uid\(\)/i);
});

test("migration 20260914001300: org_owner_read_own_org SELECT policy exists", () => {
  assert.match(MIG, /create policy.*org_owner_read_own_org/i);
  assert.match(MIG, /owner_user_id\s*=\s*auth\.uid\(\)/i);
});

test("migration 20260914001300: no INSERT/UPDATE/DELETE policy for authenticated role on organizations", () => {
  // Only two policies are defined; both are SELECT. The absence of for update /
  // for insert / for delete means authenticated users cannot write to organizations.
  const policies = MIG.match(/create policy[^;]+;/gis) || [];
  const writePolicies = policies.filter(p =>
    /for\s+(insert|update|delete)/i.test(p) && /to authenticated/i.test(p)
  );
  assert.equal(writePolicies.length, 0,
    "authenticated users must not have INSERT/UPDATE/DELETE on organizations");
});

// ---------------------------------------------------------------------------
// Trigger: organization_id write protection
// ---------------------------------------------------------------------------
test("migration 20260914001300: uses CREATE OR REPLACE FUNCTION for the trigger (no trigger rebuild needed)", () => {
  assert.match(MIG, /create or replace function public\.block_entitlement_self_grant/i);
});

test("migration 20260914001300: trigger guards organization_id from authenticated writes", () => {
  assert.match(MIG, /new\.organization_id\s+is distinct from\s+old\.organization_id/i);
});

test("migration 20260914001300: organization_id guard raises insufficient_privilege", () => {
  // Find the section after "organization_id" guard and confirm it raises
  const idx = MIG.indexOf("organization_id is distinct from old.organization_id");
  assert.ok(idx > -1, "guard must exist");
  const after = MIG.slice(idx, idx + 300);
  assert.match(after, /insufficient_privilege/i);
});

test("migration 20260914001300: trigger retains all prior entitlement column guards", () => {
  // All guards from the previous version of the trigger must still be present.
  assert.match(MIG, /new\.pass_type\s+is distinct from\s+old\.pass_type/i);
  assert.match(MIG, /new\.pass_expires_at\s+is distinct from\s+old\.pass_expires_at/i);
  assert.match(MIG, /new\.stripe_customer_id\s+is distinct from\s+old\.stripe_customer_id/i);
  assert.match(MIG, /new\.stripe_subscription_id\s+is distinct from\s+old\.stripe_subscription_id/i);
  assert.match(MIG, /new\.referral_code\s+is distinct from\s+old\.referral_code/i);
  assert.match(MIG, /new\.referred_count\s+is distinct from\s+old\.referred_count/i);
});

test("migration 20260914001300: trigger uses current_user = 'authenticated' (not current_setting('role'))", () => {
  // Prior migration used current_user; that pattern must be preserved.
  assert.match(MIG, /current_user\s*=\s*'authenticated'/i);
});

// ---------------------------------------------------------------------------
// Entitlement-integration guard: no store.js code writes organization_id
// ---------------------------------------------------------------------------
test("store.js: no user-facing code writes organization_id to families", () => {
  const store = readFileSync(
    path.join(root, "src", "store.js"), "utf-8"
  );
  // organization_id should never appear in an .update() call from client code.
  const updateBlocks = store.match(/\.update\(\{[^}]+\}\)/gs) || [];
  for (const block of updateBlocks) {
    assert.doesNotMatch(block, /organization_id/,
      `store.js update block must not write organization_id: ${block}`);
  }
});
