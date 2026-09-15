-- Data retention policy + auto-cleanup (Epic 2, E2-5).
--
-- Policy (matches src/privacy.html §6):
--   * A family is "inactive" when it hasn't recorded a new attempt AND its
--     parent hasn't signed in for 17 months (deliberately shorter than the
--     18-month deletion window so the warning goes out first).
--   * Inactive families get marked with a warning stamp
--     (retention_warned_at). Once E2-4/E4-4 email is wired, this stamp is
--     what the notifier job will read.
--   * A family that has been warned for at least 60 days AND still meets
--     the inactivity criteria is hard-deleted: auth.users row goes, and
--     the ON DELETE CASCADE FKs sweep everything else (families,
--     students, attempts, badges_earned).
--
-- Everything here runs as the postgres role (via pg_cron), which is why the
-- functions are SECURITY DEFINER + a locked search_path and why they can
-- write to auth.users.

create extension if not exists pg_cron with schema extensions;

alter table public.families
  add column if not exists retention_warned_at timestamptz;

comment on column public.families.retention_warned_at is
  'Set when the retention cleanup job first notices this family is inactive. Delete happens ~60 days later if the family stays inactive.';

-- ---------------------------------------------------------------------------
-- last_active(family_id) — greatest of: last attempt taken, last parent
-- sign-in, and family creation. Returns NULL only if all three are NULL,
-- which shouldn't happen (created_at is NOT NULL) but is defensive.
-- ---------------------------------------------------------------------------
create or replace function public.family_last_active(fam public.families)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    fam.created_at,
    (select max(a.taken_at) from public.attempts a where a.family_id = fam.id),
    (select u.last_sign_in_at from auth.users u where u.id = fam.owner_id)
  );
$$;

revoke execute on function public.family_last_active(public.families) from public;

-- ---------------------------------------------------------------------------
-- Retention step 1: mark newly-inactive families as warned. Idempotent —
-- families that already carry a warning stamp are skipped, and a fresh
-- burst of activity clears the warning (see step 3).
-- ---------------------------------------------------------------------------
create or replace function public.retention_mark_warnings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
begin
  update public.families f
    set retention_warned_at = now()
    where retention_warned_at is null
      and public.family_last_active(f) < now() - interval '17 months';
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke execute on function public.retention_mark_warnings() from public;

-- ---------------------------------------------------------------------------
-- Retention step 2: delete families warned >= 60 days ago that are STILL
-- inactive. Deletes go through auth.users so the FK cascade sweeps every
-- per-family row and no auth.users orphans are left behind.
-- ---------------------------------------------------------------------------
create or replace function public.retention_delete_expired()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer := 0;
  fam public.families%rowtype;
begin
  for fam in
    select * from public.families f
    where f.retention_warned_at is not null
      and f.retention_warned_at < now() - interval '60 days'
      and public.family_last_active(f) < now() - interval '17 months'
  loop
    delete from auth.users where id = fam.owner_id;
    deleted_count := deleted_count + 1;
  end loop;
  return deleted_count;
end;
$$;

revoke execute on function public.retention_delete_expired() from public;

-- ---------------------------------------------------------------------------
-- Retention step 3: clear the warning stamp on families that started using
-- the app again. Prevents an accidental delete on someone who came back
-- inside the 60-day grace window.
-- ---------------------------------------------------------------------------
create or replace function public.retention_clear_stale_warnings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
begin
  update public.families f
    set retention_warned_at = null
    where retention_warned_at is not null
      and public.family_last_active(f) >= now() - interval '17 months';
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke execute on function public.retention_clear_stale_warnings() from public;

-- ---------------------------------------------------------------------------
-- Schedule the three jobs. pg_cron interprets the schedule in UTC. Running
-- daily at 03:00 UTC is early enough to be off-peak everywhere and late
-- enough that yesterday's activity is fully settled.
-- ---------------------------------------------------------------------------
select cron.schedule(
  'hicap-retention-warn',
  '0 3 * * *',
  $$ select public.retention_mark_warnings(); $$
);

select cron.schedule(
  'hicap-retention-delete',
  '15 3 * * *',
  $$ select public.retention_delete_expired(); $$
);

select cron.schedule(
  'hicap-retention-clear',
  '30 3 * * *',
  $$ select public.retention_clear_stale_warnings(); $$
);
