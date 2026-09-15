-- Harden the two SECURITY DEFINER / trigger helper functions in response to
-- Supabase Security Advisor warnings.
--
-- 1. public.touch_updated_at() had a mutable search_path, meaning a caller
--    could shadow built-in names (e.g. now(), pg_catalog) with objects in a
--    schema earlier on their search_path and change what the function does.
--    Locking search_path to '' forces every unqualified reference inside the
--    function body to resolve via pg_catalog only; everything else must be
--    schema-qualified. The body only calls now(), which lives in pg_catalog,
--    so this is safe.
--
-- 2. public.handle_new_user() is SECURITY DEFINER (runs as the migration
--    owner so it can insert into public.families under RLS during signup) and
--    was directly EXECUTE-able by both anon and authenticated. That's not
--    exploitable today because it's a trigger function that returns NEW and
--    reads from it, but there's no reason a client role should be able to
--    invoke it at all — the auth.users insert trigger fires it with the
--    trigger owner's privileges regardless of grants.

alter function public.touch_updated_at() set search_path = '';

revoke execute on function public.handle_new_user() from anon, authenticated;
