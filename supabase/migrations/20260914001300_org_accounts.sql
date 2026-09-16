-- Organizations / seat-license model (Epic 7, E7-1).
--
-- A tutoring center, PTA, or district can hold a license that covers multiple
-- family seats. This migration adds the data model only — no UI, no entitlement
-- enforcement. E7-2 adds the admin dashboard; E7-3 adds bulk import.
--
-- Schema decisions:
--   seat_count      — how many family seats the license covers (0 = unlimited
--                     when seat_expires_at is also NULL, i.e., manual grant).
--   seat_expires_at — when the license expires; NULL = no expiry / manual grant.
--   owner_user_id   — the primary contact (auth.users FK); used by E7-2's admin
--                     dashboard to scope its SELECT policies.
--   slug            — URL-safe org identifier for future white-label routing
--                     (E7-4); UNIQUE, nullable (not required at creation).
--
-- families.organization_id links a family to an org. It is:
--   - ON DELETE SET NULL  — deleting the org never hard-deletes families.
--   - Write-protected     — the updated block_entitlement_self_grant trigger at
--                           the bottom of this file prevents an authenticated
--                           user from assigning or changing their own org link.
--                           Only the service role (org provisioning webhook) may
--                           write this column.

-- ---------------------------------------------------------------------------
-- 1. organizations table
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id              uuid        primary key default gen_random_uuid(),
  name            text        not null,
  slug            text        unique,
  seat_count      integer     not null default 0 check (seat_count >= 0),
  seat_expires_at timestamptz,
  owner_user_id   uuid        references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

comment on table  public.organizations                   is 'B2B license holders: tutoring centers, PTAs, districts.';
comment on column public.organizations.seat_count        is 'Number of family seats covered by this license.';
comment on column public.organizations.seat_expires_at   is 'License expiry; NULL = no expiry (manual grant).';
comment on column public.organizations.owner_user_id     is 'Primary contact / admin for this org.';

-- ---------------------------------------------------------------------------
-- 2. Link families → organizations (optional; most families are direct)
-- ---------------------------------------------------------------------------
alter table public.families
  add column if not exists organization_id uuid
    references public.organizations(id) on delete set null;

comment on column public.families.organization_id is
  'Org whose license covers this family; NULL for direct (non-B2B) accounts.';

create index if not exists families_organization_id_idx
  on public.families (organization_id)
  where organization_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Row-level security on organizations
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;

-- Families linked to an org can read that org's name, seat_count, and
-- seat_expires_at — enough for the client to show "Licensed through <name>"
-- and enforce the expiry client-side as a hint (the real enforcement is
-- server-side via seat_expires_at checks in the entitlement query).
create policy "org_members_read_own_org"
  on public.organizations for select
  to authenticated
  using (
    exists (
      select 1 from public.families
      where families.organization_id = organizations.id
        and families.owner_id = auth.uid()
    )
  );

-- The org owner can also read their own org (before any families are linked,
-- so they can verify the record was created correctly).
create policy "org_owner_read_own_org"
  on public.organizations for select
  to authenticated
  using (owner_user_id = auth.uid());

-- No INSERT / UPDATE / DELETE for authenticated role — org provisioning is
-- performed by the service role (a future admin webhook or manual script).
-- E7-2 will add an owner-scoped UPDATE policy for name/slug changes.

-- ---------------------------------------------------------------------------
-- 4. Protect organization_id from client writes
--
--    Extends the block_entitlement_self_grant trigger (last updated in
--    20260914001200_referral_write_protection.sql) with one additional guard.
--    CREATE OR REPLACE re-uses the existing trigger binding on families —
--    no DROP/CREATE trigger is needed.
-- ---------------------------------------------------------------------------
create or replace function public.block_entitlement_self_grant()
returns trigger
language plpgsql
security invoker
as $$
begin
  -- current_user is 'authenticated' for every PostgREST request with a user
  -- JWT. Service-role requests run as postgres and bypass all guards here.
  if current_user = 'authenticated' then

    -- Stripe entitlement columns: never writable by the client.
    if (new.pass_type              is distinct from old.pass_type)
    or (new.pass_expires_at        is distinct from old.pass_expires_at)
    or (new.pass_student_id        is distinct from old.pass_student_id)
    or (new.stripe_customer_id     is distinct from old.stripe_customer_id)
    or (new.stripe_subscription_id is distinct from old.stripe_subscription_id)
    then
      raise exception
        'permission denied: entitlement fields are managed by the payment system'
        using errcode = 'insufficient_privilege';
    end if;

    -- referral_code: immutable once set.
    if new.referral_code is distinct from old.referral_code then
      raise exception
        'permission denied: referral_code is immutable'
        using errcode = 'insufficient_privilege';
    end if;

    -- referred_by: write-once (can be set from NULL, never changed once set).
    if old.referred_by is not null and new.referred_by is distinct from old.referred_by then
      raise exception
        'permission denied: referred_by cannot be changed once set'
        using errcode = 'insufficient_privilege';
    end if;

    -- referred_count: service-role-only.
    if new.referred_count is distinct from old.referred_count then
      raise exception
        'permission denied: referred_count is managed by the payment system'
        using errcode = 'insufficient_privilege';
    end if;

    -- organization_id: service-role-only. An authenticated user cannot assign
    -- or change their own org link — only the org-provisioning service role may
    -- write this column (to prevent a family from claiming a paid org seat they
    -- don't own).
    if new.organization_id is distinct from old.organization_id then
      raise exception
        'permission denied: organization_id is managed by org provisioning'
        using errcode = 'insufficient_privilege';
    end if;

  end if;
  return new;
end;
$$;
