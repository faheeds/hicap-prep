-- Referral column write protection (Epic 6, E6-2 security follow-up).
--
-- The E6-2 migration added referral_code, referred_by, and referred_count to
-- families. The existing block_entitlement_self_grant trigger (20260914000900)
-- guards the five Stripe columns, but not the referral fields.
--
-- Without this migration, an authenticated user can:
--   - Change their referral_code (claim another family's link).
--   - Set referred_by to any code (fake referral attribution / promo eligibility).
--   - Increment referred_count to fake referral metrics.
--
-- This migration extends the trigger to enforce:
--   referral_code   — immutable once set (the trigger on handle_new_user sets it
--                     at row creation; it must never change after that).
--   referred_by     — write-once: can be written from NULL, but not changed once
--                     set. The JS already checks !fam.referred_by before writing;
--                     this makes the guarantee unconditional.
--   referred_count  — service-role-only: only the stripe-webhook (running as
--                     postgres, not authenticated) may increment this.
--
-- Service-role requests bypass the trigger (current_user = 'postgres', not
-- 'authenticated'), so the webhook and admin functions are unaffected.

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

    -- referred_by: write-once. Clients may set it from NULL but may not change
    -- or clear it once set. The store.js already guards this in JS; this makes
    -- the guarantee unconditional.
    if old.referred_by is not null and new.referred_by is distinct from old.referred_by then
      raise exception
        'permission denied: referred_by cannot be changed once set'
        using errcode = 'insufficient_privilege';
    end if;

    -- referred_count: never writable by the client; only the webhook (service role)
    -- may increment it.
    if new.referred_count is distinct from old.referred_count then
      raise exception
        'permission denied: referred_count is managed by the payment system'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;
