-- Explicit UPDATE/DELETE denial for org_roster_entries (Epic 7, E7-3 hardening).
--
-- The original E7-3 migration (20260914001500) relied on RLS default-deny
-- (no permissive policy = deny) to block authenticated UPDATE and DELETE.
-- That is correct but implicit. This migration makes the denial explicit via
-- RESTRICTIVE policies so the intent is auditable and cannot be accidentally
-- overridden by a future permissive FOR ALL policy.
--
-- RESTRICTIVE policies behave like an AND-gate: even if a permissive policy
-- later grants the operation, this restrictive USING(false) blocks it.
-- claimed_by_family_id is updated by the service role (not authenticated), so
-- no permissive UPDATE path for authenticated is ever expected here.

create policy "org_roster_no_update"
  on public.org_roster_entries as restrictive
  for update
  to authenticated
  using (false);

create policy "org_roster_no_delete"
  on public.org_roster_entries as restrictive
  for delete
  to authenticated
  using (false);
