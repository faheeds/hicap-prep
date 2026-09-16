-- Referral program (Epic 6, E6-2).
--
-- Each family gets a unique 8-character referral code. When a new family
-- signs up via a referral link (?ref=ABCD1234), their referred_by column
-- is set to the referrer's code. On checkout completion the webhook
-- increments the referrer's referred_count so the app can surface it.
--
-- Design notes:
--   * referral_code is generated from gen_random_uuid() so it's unique
--     without needing a sequence. The unique index enforces this at the DB
--     level in case of (astronomically unlikely) collision.
--   * referred_by stores a code, not a foreign key, so it survives referrer
--     account deletion without needing ON DELETE SET NULL logic.
--   * referred_count is incremented by the stripe-webhook on
--     checkout.session.completed for referred families only. It's advisory
--     — the founder uses it to decide when to honor a referrer reward.

alter table public.families
  add column if not exists referral_code  text    not null default '',
  add column if not exists referred_by    text,
  add column if not exists referred_count integer not null default 0;

-- Backfill existing families (default '' won't trigger; generate now).
update public.families
set referral_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
where referral_code = '';

-- Uniqueness guard: collisions are prevented at insert time. The
-- handle_new_user trigger (updated below) generates a fresh UUID each time,
-- making collision probability < 1 in 4 billion per family.
create unique index if not exists families_referral_code_idx
  on public.families(referral_code);

-- Update the families insert trigger to include referral_code.
-- This replaces the function defined in 20260914000000 — the body is
-- identical except for the added referral_code column.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.families (owner_id, referral_code)
  values (
    new.id,
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  );
  return new;
end;
$$;
