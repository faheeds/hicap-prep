-- Stripe entitlements (Epic 3, E3-1 / E3-2 / E3-3 / E3-5).
--
-- Adds per-family payment/entitlement state to the families table so the
-- stripe-webhook edge function has somewhere to record what a family has
-- purchased, and so the app's entitlement gate (E3-4) can read it.
--
-- pass_type values:
--   'free'           — no active pass (default)
--   'individual'     — one-time Individual Pass ($49), one student
--   'family'         — one-time Family Pass ($79), all students
--   'family_annual'  — Annual auto-renew Family Pass ($129/yr)
--
-- pass_student_id    — set for 'individual' only; the student UUID who holds
--                      the pass.  NULL for family passes.
-- pass_expires_at    — when the pass expires.  For subscriptions, Stripe
--                      updates this on each renewal via the webhook.
--                      NULL = not yet set (free) or lifetime (not used here).
-- stripe_customer_id — persisted so we can create a Billing Portal session
--                      for E3-8 without a Stripe lookup.
-- stripe_subscription_id — set when a subscription is active; NULL for one-
--                      time purchases.

alter table public.families
  add column if not exists pass_type             text        not null default 'free',
  add column if not exists pass_student_id       text,
  add column if not exists pass_expires_at       timestamptz,
  add column if not exists stripe_customer_id    text,
  add column if not exists stripe_subscription_id text;

comment on column public.families.pass_type is
  'free | individual | family | family_annual. Set by stripe-webhook on successful purchase.';
comment on column public.families.pass_student_id is
  'UUID of the student entitled on an Individual Pass. NULL for family-wide passes.';
comment on column public.families.pass_expires_at is
  'When the pass expires. Stripe updates this on each subscription renewal.';
comment on column public.families.stripe_customer_id is
  'Stripe Customer ID, stored so we can open a Billing Portal session without re-querying Stripe.';
comment on column public.families.stripe_subscription_id is
  'Active Stripe Subscription ID. NULL for one-time purchases.';

-- index so the webhook can cheaply look up a family by stripe_customer_id
create index if not exists families_stripe_customer_id_idx
  on public.families (stripe_customer_id)
  where stripe_customer_id is not null;
