-- Add pool_cursors to students for shuffled-bag question sampling (Epic 6 / E6-3).
--
-- Stores which items remain in the current cycle for each
-- (effective_level, battery, tier, subtest) combination, keyed as
-- "13-verbal-1-SC" → [remaining stable item ids]. When the array empties
-- the client starts a fresh shuffled cycle, guaranteeing zero repeats until
-- the student has seen every item in the pool at least once.
--
-- jsonb (not a separate table) because:
--   * At most 9 keys × ~20 ids each ≈ <2 KB per student.
--   * Updated on every practice launch (fire-and-forget inside the student upsert).
--   * No cross-student or cross-family queries needed.

alter table public.students
  add column if not exists pool_cursors jsonb not null default '{}'::jsonb;
