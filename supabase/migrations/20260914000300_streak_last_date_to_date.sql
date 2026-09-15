-- Convert students.streak_last_date from text to date.
--
-- The initial schema (20260914000000_initial_schema.sql) is already applied
-- to the hosted database, so this change ships as an additive migration
-- rather than an edit to the initial file — editing an applied migration
-- would diverge local history from what Postgres has recorded.
--
-- The CASE handles rows that might still carry the old Date.prototype
-- .toDateString() format (e.g. "Mon Sep 14 2026") from before the app
-- switched to ISO. Anything that doesn't already look like YYYY-MM-DD gets
-- nulled out — the streak just resets for that student, which is far less
-- destructive than the whole ALTER failing.

alter table students alter column streak_last_date type date using
  case when streak_last_date ~ '^\d{4}-\d{2}-\d{2}$'
    then streak_last_date::date
    else null
  end;
