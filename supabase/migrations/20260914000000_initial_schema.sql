-- HiCap Prep initial schema (Epic 1, E1-3).
--
-- Replaces the single shared JSON blob (window.storage / localStorage) with
-- normalized tables scoped to a family. One family = one parent auth user.
--
-- Row-level security is enabled here but the policies themselves live in the
-- next migration (E1-4) so the intent stays legible.

-- pgcrypto ships in Supabase; safe to enable idempotently for gen_random_uuid().
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- families: one row per parent account (auth.users.id -> owner_id, unique).
-- The parent PIN lives here (as a bcrypt-style hash) so E1-6 can move PIN
-- verification server-side. pin_failed_attempts / pin_locked_until back the
-- rate limit that E1-6 will enforce in the verify-pin edge function.
-- ---------------------------------------------------------------------------
create table public.families (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null unique references auth.users (id) on delete cascade,
  parent_pin_hash      text,
  pin_failed_attempts  integer not null default 0,
  pin_locked_until     timestamptz,
  consented_at         timestamptz, -- filled by Epic 2's COPPA consent flow
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.families is 'One row per parent account; roots all per-family data.';
comment on column public.families.parent_pin_hash is 'bcrypt-style hash; PIN is never stored in plaintext (see E1-6).';

-- ---------------------------------------------------------------------------
-- students: kids on the family roster. cogat_level + grade are here from day
-- one so Epic 5's multi-grade expansion is *not* a second migration — the
-- prototype's Level-13-only content maps to cogat_level=13, grade=7.
--
-- Grade 1 uses CogAT Level 8 (Epic 9 — picture-based, structurally different).
-- Grades 3–11 use CogAT Levels 9–17. Grades 2 and K are auto-screened and are
-- deliberately not in this range (see PRODUCT_BACKLOG.md Epic 5 preamble).
-- ---------------------------------------------------------------------------
create table public.students (
  id                  uuid primary key default gen_random_uuid(),
  family_id           uuid not null references public.families (id) on delete cascade,
  name                text not null check (length(trim(name)) > 0),
  avatar              text not null default '🦊',
  color               text not null default '#3B6E5E',
  grade               smallint not null default 7 check (grade = 1 or grade between 3 and 11),
  cogat_level         smallint not null default 13 check (cogat_level between 8 and 17),
  streak_current      integer not null default 0,
  streak_longest      integer not null default 0,
  streak_last_date    text, -- kept as an ISO date string to match the current in-app logic
  badges_seen         jsonb not null default '[]'::jsonb, -- transient "new badge" flags
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on column public.students.grade is 'US grade level (1 or 3–11).';
comment on column public.students.cogat_level is 'Corresponding CogAT level (8 or 9–17). Kept explicit so E5-0 does not need another migration.';

-- ---------------------------------------------------------------------------
-- attempts: every practice / program-day / mock / review session. family_id
-- is denormalized so RLS can filter without a join on every row read.
-- ---------------------------------------------------------------------------
create type public.attempt_kind as enum ('practice', 'program', 'mock', 'review');

create table public.attempts (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid not null references public.students (id) on delete cascade,
  family_id           uuid not null references public.families (id) on delete cascade,
  taken_at            timestamptz not null default now(),
  title               text not null,
  kind                public.attempt_kind not null,
  week_key            text, -- e.g. "w3-mon" for program days; null for free practice
  correct             integer not null check (correct >= 0),
  total               integer not null check (total >= 0),
  by_sub              jsonb not null default '{}'::jsonb,       -- { "SC": {"c":8,"n":10}, ... }
  wrong_questions     jsonb not null default '[]'::jsonb,       -- array of {q,o,a,e,your}
  created_at          timestamptz not null default now()
);

create index attempts_student_taken_at_idx
  on public.attempts (student_id, taken_at desc);

create index attempts_family_taken_at_idx
  on public.attempts (family_id, taken_at desc);

-- ---------------------------------------------------------------------------
-- badges_earned: one row per (student, badge). computeBadges() logic in the
-- app derives current state from attempts, but persisted rows let us surface
-- new-badge celebrations and future org/leaderboard queries cheaply.
-- ---------------------------------------------------------------------------
create table public.badges_earned (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students (id) on delete cascade,
  family_id    uuid not null references public.families (id) on delete cascade,
  badge_id     text not null,
  earned_at    timestamptz not null default now(),
  unique (student_id, badge_id)
);

create index badges_earned_family_idx on public.badges_earned (family_id);

-- ---------------------------------------------------------------------------
-- Trigger: create a matching families row automatically on new auth user.
-- Runs with the definer's privileges so the anon-key session that just signed
-- up can still see the row via RLS immediately (owner_id = auth.uid()).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.families (owner_id)
  values (new.id)
  on conflict (owner_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- updated_at auto-maintenance (families, students only — attempts are append-
-- only, badges_earned are immutable once written).
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger families_touch_updated_at
  before update on public.families
  for each row execute function public.touch_updated_at();

create trigger students_touch_updated_at
  before update on public.students
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: enable on every table now. Policies land in the next migration (E1-4)
-- so this file is safe to leave applied without them — with no policies,
-- non-service-role clients get denied by default, which is the correct
-- "closed until we say otherwise" posture.
-- ---------------------------------------------------------------------------
alter table public.families      enable row level security;
alter table public.students      enable row level security;
alter table public.attempts      enable row level security;
alter table public.badges_earned enable row level security;
