-- Gate the retention automation behind a runtime feature flag.
--
-- The retention functions from 20260914000500_retention_policy.sql are live
-- on cron, but until E4-4 (email reminders) ships and something surfaces
-- families.retention_warned_at to the parent, the 60-day grace period is a
-- silent countdown — see PRODUCT_BACKLOG.md E2-5 for the full write-up.
-- Rather than leaving the delete function armed and hoping E4-4 lands in
-- time, this migration flips the whole retention pipeline off by default.
--
-- The cron.schedule(...) entries stay in place. The jobs keep firing on
-- their normal 03:00 / 03:15 / 03:30 UTC cadence so they show up in
-- cron.job_run_details, but each function short-circuits with a NOTICE
-- while the flag is off — that way "did the job run today?" is still an
-- observable question, and turning the flag back on doesn't need another
-- migration or a re-schedule.
--
-- Uses `create or replace function` throughout — the earlier retention
-- migration file is already applied to the hosted database and must not
-- be edited (see feedback memory / earlier session note).

-- ---------------------------------------------------------------------------
-- app_settings: singleton row, forced by (id boolean primary key) with a
-- CHECK constraint pinning id to true. There can only ever be one row, so
-- reads never need to filter beyond `where id = true` (and that filter
-- doubles as documentation).
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  id                              boolean primary key default true,
  retention_automation_enabled    boolean not null default false,
  updated_at                      timestamptz not null default now(),
  constraint app_settings_singleton check (id = true)
);

comment on table public.app_settings is 'Singleton — exactly one row. Runtime feature flags for jobs that can''t be safely toggled by editing code.';
comment on column public.app_settings.retention_automation_enabled is
  'When false, retention_mark_warnings / retention_delete_expired / retention_clear_stale_warnings all short-circuit with a NOTICE. Flip via `update public.app_settings set retention_automation_enabled = true where id = true;` once E4-4 email notifications are wired.';

-- Seed the singleton row with the flag OFF. The insert is idempotent; a
-- follow-up `set` from an operator will preserve their chosen value.
insert into public.app_settings (id, retention_automation_enabled)
  values (true, false)
  on conflict (id) do nothing;

-- Lock down direct client access: RLS on with no policies denies anon and
-- authenticated by default. Only the postgres role / service role can read
-- or mutate it, which is what we want — the retention functions read it as
-- SECURITY DEFINER and operators write it via the SQL editor.
alter table public.app_settings enable row level security;

-- ---------------------------------------------------------------------------
-- Helper: single source of truth for the flag. Marked STABLE so the query
-- planner is free to cache the read across a single statement, and
-- SECURITY DEFINER so the caller doesn't need direct SELECT on
-- app_settings. Locked search_path per the same rule the existing
-- retention functions already follow.
-- ---------------------------------------------------------------------------
create or replace function public.retention_automation_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.retention_automation_enabled from public.app_settings s where s.id = true),
    false
  );
$$;

revoke execute on function public.retention_automation_enabled() from public;

-- ---------------------------------------------------------------------------
-- Re-define the three retention functions with an early-exit check. Bodies
-- are otherwise identical to 20260914000500_retention_policy.sql — the
-- guard is a plain `if not enabled then raise notice … return 0; end if;`
-- at the top. RAISE NOTICE (not LOG or DEBUG) so the message lands in
-- cron.job_run_details.return_message where the operator will actually see
-- it, without spamming the general Postgres log at higher levels.
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
  if not public.retention_automation_enabled() then
    raise notice 'retention automation disabled, skipping retention_mark_warnings';
    return 0;
  end if;

  update public.families f
    set retention_warned_at = now()
    where retention_warned_at is null
      and public.family_last_active(f) < now() - interval '17 months';
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke execute on function public.retention_mark_warnings() from public;

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
  if not public.retention_automation_enabled() then
    raise notice 'retention automation disabled, skipping retention_delete_expired';
    return 0;
  end if;

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

create or replace function public.retention_clear_stale_warnings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
begin
  if not public.retention_automation_enabled() then
    raise notice 'retention automation disabled, skipping retention_clear_stale_warnings';
    return 0;
  end if;

  update public.families f
    set retention_warned_at = null
    where retention_warned_at is not null
      and public.family_last_active(f) >= now() - interval '17 months';
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke execute on function public.retention_clear_stale_warnings() from public;

-- Note: the three cron.schedule(...) entries from 20260914000500 are
-- intentionally left alone. They still fire on time; the functions
-- themselves just short-circuit while the flag is off.
