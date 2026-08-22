-- Pin search_path on every guard so a caller cannot shadow `public` and neuter them.
alter function public.is_service_role()      set search_path = public, pg_temp;
alter function public.guard_memory_update()  set search_path = public, pg_temp;
alter function public.guard_memory_insert()  set search_path = public, pg_temp;
alter function public.guard_remark_update()  set search_path = public, pg_temp;
alter function public.guard_story_update()   set search_path = public, pg_temp;

-- These are reachable at /rest/v1/rpc/... by default. consume_rate_limit is the one
-- that matters: an anonymous caller could otherwise inflate a bucket and lock a
-- legitimate guest out, or probe bucket names. Trigger functions are revoked too —
-- nothing should be able to invoke them outside the triggers that own them.
--
-- NOTE: revoking is_service_role() here was a mistake, corrected in
-- 20260821230559_fix_is_service_role_execute.sql. It is called by the guard
-- TRIGGERS, which run as the invoking user, so revoking it broke every client
-- insert and update with "permission denied for function is_service_role". The
-- revoke is left in place rather than edited out so the history stays honest and
-- the fix migration explains itself.
revoke all on function public.consume_rate_limit(text, integer, interval) from public, anon, authenticated;
revoke all on function public.sync_contributor_count()                    from public, anon, authenticated;
revoke all on function public.sync_story_approval()                       from public, anon, authenticated;
revoke all on function public.is_service_role()                           from public, anon, authenticated;

-- Only the service role, which is what the Edge Functions run as.
grant execute on function public.consume_rate_limit(text, integer, interval) to service_role;
