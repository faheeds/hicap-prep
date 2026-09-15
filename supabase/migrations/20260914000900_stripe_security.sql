-- Stripe security hardening (Epic 3 security review).
--
-- 1. block_entitlement_self_grant trigger
--    The families_owner_update RLS policy allows an authenticated user to
--    UPDATE any column on their own families row (it only enforces *which row*
--    can be touched, not *which columns*). Without this trigger, a user with
--    browser devtools or a Supabase SDK call could promote themselves to any
--    pass tier for free by directly writing pass_type / pass_expires_at.
--
--    This BEFORE UPDATE trigger blocks modifications to the five entitlement
--    columns when the request originates from the 'authenticated' PostgreSQL
--    role (i.e. any browser / app client). The Stripe webhook edge function
--    runs under the service role, which bypasses RLS entirely and is not
--    subject to this trigger's guard.
--
-- 2. stripe_processed_events table
--    Stripe's webhook delivery is at-least-once: duplicate event delivery is
--    normal. Without a processed-event log, a late duplicate
--    checkout.session.completed could re-grant access that was legitimately
--    revoked by a subsequent subscription.deleted. This table records every
--    event ID so the webhook handler can skip duplicates.
--
--    RLS is enabled with no policies → authenticated and anon roles have
--    zero access. The service-role webhook handler bypasses RLS.

-- ---------------------------------------------------------------------------
-- 1. Entitlement-column protection trigger
-- ---------------------------------------------------------------------------

create or replace function public.block_entitlement_self_grant()
returns trigger
language plpgsql
security invoker
as $$
begin
  -- current_user is 'authenticated' for every request that arrived through
  -- PostgREST with a user JWT. Service-role requests run as postgres and are
  -- not affected by this guard.
  if current_user = 'authenticated' then
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
  end if;
  return new;
end;
$$;

create trigger families_block_entitlement_self_grant
  before update on public.families
  for each row execute function public.block_entitlement_self_grant();

-- ---------------------------------------------------------------------------
-- 2. Processed-events table for webhook idempotency
-- ---------------------------------------------------------------------------

create table if not exists public.stripe_processed_events (
  event_id     text        not null,
  processed_at timestamptz not null default now(),
  constraint stripe_processed_events_pkey primary key (event_id)
);

-- Enable RLS with no policies so authenticated and anon roles get no access.
-- The service-role webhook handler bypasses RLS and has full CRUD access.
alter table public.stripe_processed_events enable row level security;
