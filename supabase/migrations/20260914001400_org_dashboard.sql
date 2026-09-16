-- Org usage dashboard RPC function (Epic 7, E7-2).
--
-- get_org_stats(p_org_id) returns a JSON object with:
--   org:          id, name, slug, seat_count, seat_expires_at
--   seats_in_use: count of families linked to this org
--   families:     per-family aggregate (no student names, no quiz answers)
--     family_id, student_count, attempt_count,
--     total_correct, total_answered, accuracy_pct, last_active
--
-- Privacy contract:
--   - Student names are never included (children's data, not for org view).
--   - Individual question answers (wrong_questions jsonb) are never returned.
--   - Only aggregate counts and accuracy percentages are exposed.
--
-- Security contract:
--   - SECURITY DEFINER so the function can read other families' rows
--     (which RLS would otherwise block for the caller's role).
--   - The very first thing the function does is verify auth.uid() = owner_user_id.
--     A non-owner calling this function gets insufficient_privilege regardless
--     of SECURITY DEFINER — the elevated privileges are never reached.
--   - search_path is pinned to 'public' to prevent search-path hijacking.

create or replace function public.get_org_stats(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_user_id uuid;
  v_result        jsonb;
begin
  -- Ownership check: must be the first thing, before any data access.
  select owner_user_id into v_owner_user_id
    from organizations
   where id = p_org_id;

  if v_owner_user_id is null or v_owner_user_id is distinct from auth.uid() then
    raise exception
      'permission denied: caller is not the owner of this organization'
      using errcode = 'insufficient_privilege';
  end if;

  -- Build response. Subqueries for per-family stats keep this readable.
  -- families array is always an array (never null) — COALESCE to [].
  select jsonb_build_object(
    'org', jsonb_build_object(
      'id',              o.id,
      'name',            o.name,
      'slug',            o.slug,
      'seat_count',      o.seat_count,
      'seat_expires_at', o.seat_expires_at
    ),
    'seats_in_use', (
      select count(*) from families where organization_id = p_org_id
    ),
    'families', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'family_id',      f.id,
          'student_count',  (select count(*) from students  where family_id = f.id),
          'attempt_count',  (select count(*) from attempts  where family_id = f.id),
          'total_correct',  (select coalesce(sum(correct), 0) from attempts where family_id = f.id),
          'total_answered', (select coalesce(sum(total),   0) from attempts where family_id = f.id),
          'last_active',    (select max(taken_at)            from attempts where family_id = f.id),
          'accuracy_pct',   (
            select case
              when coalesce(sum(total), 0) = 0 then null
              else round(100.0 * sum(correct) / sum(total))
            end
            from attempts where family_id = f.id
          )
        )
      )
      from families f
      where f.organization_id = p_org_id
    ), '[]'::jsonb)
  )
  into v_result
  from organizations o
  where o.id = p_org_id;

  return v_result;
end;
$$;

-- Grant execute to authenticated so PostgREST / supabase.rpc() can call it.
-- The ownership check inside the function gates the actual data.
grant execute on function public.get_org_stats(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Also: query to let the client know if the signed-in user owns any org.
-- This is a simple view rather than an RPC so the client can use .from().
-- ---------------------------------------------------------------------------
create or replace view public.my_owned_orgs as
  select
    id,
    name,
    slug,
    seat_count,
    seat_expires_at,
    created_at
  from public.organizations
  where owner_user_id = auth.uid();

-- The view uses auth.uid() in its filter, so it's safe to expose to anon
-- (returns nothing for unauthenticated callers) and authenticated (returns
-- only orgs the caller owns).
grant select on public.my_owned_orgs to authenticated, anon;
