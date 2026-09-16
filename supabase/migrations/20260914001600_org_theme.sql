-- Org white-label theming (Epic 7, E7-4).
--
-- Adds a theme_overrides jsonb column to organizations. An org can supply a
-- subset of CSS custom-property values (e.g., --flare, --lagoon) that the
-- app applies on load when a family belongs to this org.
--
-- Security contract:
--   - Only the service role may write theme_overrides (the org owner UPDATE
--     policy added below covers name/slug only — a deliberate restriction so
--     CSS injection via user-supplied values is not an authenticated path).
--   - The client whitelists allowed token names before injecting any value;
--     the column is a convenience channel, not a trusted CSS source.
--
-- Existing policies on organizations already let owners and members read
-- the row — theme_overrides rides those same SELECT policies.

alter table public.organizations
  add column if not exists theme_overrides jsonb;

comment on column public.organizations.theme_overrides is
  'Optional CSS custom-property overrides for white-label theming. Keys must match the app whitelist; written by service role only.';

-- Allow org owners to update name and slug (not theme_overrides — that stays
-- service-role-only so no CSS injection path exists through authenticated writes).
create policy "org_owner_update_name_slug"
  on public.organizations for update
  to authenticated
  using   (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());
