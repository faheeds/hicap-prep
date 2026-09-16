// Sanity-check the E1-3 initial schema. We can't run Postgres in unit tests
// without a Docker image handy, but the migration file is a source-of-truth
// artifact and small enough that shape checks are worthwhile — this catches
// accidental drops of required tables/columns during future edits.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const MIGRATIONS_DIR = new URL("../supabase/migrations/", import.meta.url);

function readAllMigrations() {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  return files.map((f) => readFileSync(new URL(f, MIGRATIONS_DIR), "utf-8")).join("\n\n");
}

test("initial schema defines all required tables", () => {
  const sql = readAllMigrations();
  for (const tbl of ["families", "students", "attempts", "badges_earned"]) {
    assert.match(sql, new RegExp(`create table public\\.${tbl}`, "i"), `expected create table for ${tbl}`);
  }
});

test("students table carries cogat_level and grade columns (Epic 5 forward compat)", () => {
  const sql = readAllMigrations();
  assert.match(sql, /cogat_level\s+smallint/i);
  assert.match(sql, /grade\s+smallint/i);
  // Level range must cover 8 (grade 1) and 9..17 (grades 3..11) per Epic 5 preamble.
  assert.match(sql, /cogat_level between 8 and 17/i);
  // Grade constraint must allow 1 (Epic 9) OR 3..11 (Epic 5) but never 2/K.
  assert.match(sql, /grade\s*=\s*1\s+or\s+grade\s+between\s+3\s+and\s+11/i);
});

test("families table stores a PIN hash, not a plaintext PIN", () => {
  const sql = readAllMigrations();
  assert.match(sql, /parent_pin_hash\s+text/i, "PIN column must be a hash");
  assert.doesNotMatch(sql, /parent_pin\s+text/i, "no plaintext parent_pin column allowed");
});

test("rate-limit columns exist on families for E1-6 to enforce", () => {
  const sql = readAllMigrations();
  assert.match(sql, /pin_failed_attempts\s+integer/i);
  assert.match(sql, /pin_locked_until\s+timestamptz/i);
});

test("row-level security is enabled on every user-data table", () => {
  const sql = readAllMigrations();
  for (const tbl of ["families", "students", "attempts", "badges_earned"]) {
    assert.match(sql, new RegExp(`alter table public\\.${tbl}\\s+enable row level security`, "i"),
      `RLS must be enabled on ${tbl}`);
  }
});

test("a new auth user gets a families row via trigger", () => {
  const sql = readAllMigrations();
  assert.match(sql, /create trigger on_auth_user_created/i);
  assert.match(sql, /handle_new_user/i);
});

test("RLS policies exist on every table and every one references auth.uid()", () => {
  const sql = readAllMigrations();
  // At minimum, every user-visible table needs a SELECT policy tied to auth.uid().
  for (const tbl of ["families", "students", "attempts", "badges_earned"]) {
    const re = new RegExp(`create policy [\\w_]+ on public\\.${tbl}[\\s\\S]*?auth\\.uid\\(\\)`, "i");
    assert.match(sql, re, `${tbl} needs a policy keyed on auth.uid()`);
  }
});

test("retention: 18-month deletion window is composed of a 17-month warn + 60-day grace", () => {
  const sql = readAllMigrations();
  // Backlog acceptance for E2-5: "auto-delete inactive family data after
  // 18 months, with a warning email first." The 17-month warn is the
  // trigger point and the 60-day grace pushes the actual delete out past
  // 18 months without needing to name that number literally.
  assert.match(sql, /interval '17 months'/, "retention warning window must be 17 months");
  assert.match(sql, /interval '60 days'/, "grace period between warning and delete must be 60 days");
  assert.match(sql, /retention_warned_at\s+timestamptz/i, "families needs a retention_warned_at column");
  assert.match(sql, /cron\.schedule\(\s*'hicap-retention-warn'/i, "warning job must be scheduled");
  assert.match(sql, /cron\.schedule\(\s*'hicap-retention-delete'/i, "delete job must be scheduled");
  assert.match(sql, /cron\.schedule\(\s*'hicap-retention-clear'/i, "clear-warning job must be scheduled");
});

test("retention: automation is gated on the app_settings feature flag, disabled by default", () => {
  const sql = readAllMigrations();
  // Singleton settings table with the constraint that forces exactly one row.
  assert.match(sql, /create table if not exists public\.app_settings/i, "app_settings singleton table must exist");
  assert.match(sql, /constraint app_settings_singleton check \(id = true\)/i, "singleton must be enforced by a CHECK on id");
  assert.match(sql, /retention_automation_enabled\s+boolean not null default false/i, "flag must default to disabled");

  // Every retention function short-circuits when the flag is off, with a
  // NOTICE so cron.job_run_details records that it ran (not that it was
  // silently skipped).
  for (const fn of ["retention_mark_warnings", "retention_delete_expired", "retention_clear_stale_warnings"]) {
    const re = new RegExp(`function public\\.${fn}[\\s\\S]*?retention_automation_enabled\\(\\)[\\s\\S]*?raise notice 'retention automation disabled`, "i");
    assert.match(sql, re, `${fn} must early-exit + raise notice when the flag is off`);
  }

  // Cron schedules from the previous migration must remain untouched —
  // no `cron.unschedule` calls, and the three job names still appear.
  assert.doesNotMatch(sql, /cron\.unschedule/i, "cron.schedule entries should be left intact — no unschedule");
});

test("students table carries pool_cursors jsonb column for shuffled-bag sampling", () => {
  const sql = readAllMigrations();
  assert.match(sql, /pool_cursors\s+jsonb/i, "pool_cursors must be a jsonb column on students");
  assert.match(sql, /default '\{\}'::jsonb/i, "pool_cursors must default to an empty object");
});

test("students/attempts/badges policies scope to caller's own family_id, not any family", () => {
  const sql = readAllMigrations();
  // A policy that forgets the family-owner subselect would let a signed-in
  // parent read *any* row — catch that pattern by requiring the owner check.
  const familyScoped = /family_id in \(select id from public\.families where owner_id = auth\.uid\(\)\)/gi;
  const matches = sql.match(familyScoped) || [];
  // 3 tables (students/attempts/badges_earned), roughly ~3 policies each = at
  // least 6 uses. Not a hard count, but a low bar that catches "forgot the
  // subselect on one policy" mistakes.
  assert.ok(matches.length >= 6,
    `expected family-scoped subselect to appear on many policies, saw ${matches.length}`);
});
