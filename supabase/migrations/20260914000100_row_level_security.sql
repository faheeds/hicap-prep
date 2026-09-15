-- Row-level security policies (Epic 1, E1-4).
--
-- Every policy is anchored to auth.uid() so a family can *only* ever see or
-- mutate its own rows — enforced by Postgres, not by client-side app logic.
-- The service-role key bypasses RLS by design; only the anon key + a signed-in
-- JWT touches these policies at the app layer.
--
-- Design shape:
--   families      : owner_id = auth.uid()          (one row per parent)
--   students      : family_id in (my family's id)
--   attempts      : same
--   badges_earned : same
--
-- Using EXISTS/IN against families instead of joining every time keeps the
-- policies self-contained; family_id is denormalized on attempts/badges so
-- these predicates never need a subquery on the child table.

-- ---------------------------------------------------------------------------
-- families
-- ---------------------------------------------------------------------------
create policy families_owner_select on public.families
  for select using (owner_id = auth.uid());

create policy families_owner_update on public.families
  for update using (owner_id = auth.uid())
             with check (owner_id = auth.uid());

-- Insert is normally handled by the on_auth_user_created trigger, but we
-- still allow the owner to insert their own row (idempotent — the unique
-- constraint on owner_id blocks duplicates).
create policy families_owner_insert on public.families
  for insert with check (owner_id = auth.uid());

-- E1-7 (account deletion) uses a service-role edge function to cascade
-- through auth.users; families rows disappear via the on-delete-cascade
-- FK, so no user-facing DELETE policy on families is needed here.

-- ---------------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------------
create policy students_family_select on public.students
  for select using (
    family_id in (select id from public.families where owner_id = auth.uid())
  );

create policy students_family_insert on public.students
  for insert with check (
    family_id in (select id from public.families where owner_id = auth.uid())
  );

create policy students_family_update on public.students
  for update using (
    family_id in (select id from public.families where owner_id = auth.uid())
  ) with check (
    family_id in (select id from public.families where owner_id = auth.uid())
  );

create policy students_family_delete on public.students
  for delete using (
    family_id in (select id from public.families where owner_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- attempts
-- ---------------------------------------------------------------------------
create policy attempts_family_select on public.attempts
  for select using (
    family_id in (select id from public.families where owner_id = auth.uid())
  );

create policy attempts_family_insert on public.attempts
  for insert with check (
    family_id in (select id from public.families where owner_id = auth.uid())
  );

-- Attempts are treated as append-only historical records; no UPDATE policy.
-- DELETE is intentionally allowed so E1-7 (per-student wipe) and future
-- retention cleanup can run through the same policies.
create policy attempts_family_delete on public.attempts
  for delete using (
    family_id in (select id from public.families where owner_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- badges_earned
-- ---------------------------------------------------------------------------
create policy badges_family_select on public.badges_earned
  for select using (
    family_id in (select id from public.families where owner_id = auth.uid())
  );

create policy badges_family_insert on public.badges_earned
  for insert with check (
    family_id in (select id from public.families where owner_id = auth.uid())
  );

create policy badges_family_delete on public.badges_earned
  for delete using (
    family_id in (select id from public.families where owner_id = auth.uid())
  );
