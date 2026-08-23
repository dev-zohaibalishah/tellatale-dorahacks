-- Realtime, actually turned on.
--
-- The adapter has subscribed to `postgres_changes` since the beginning —
-- `watchMemories`, `watchRemarks`, `watchStory`, and now `watchNotifications`. Every
-- one of those channels connected, reported SUBSCRIBED, and then delivered nothing,
-- because a Postgres change is only published to Supabase Realtime if the table is a
-- member of the `supabase_realtime` publication, and that publication was empty.
--
-- The failure is completely silent. Nothing errors, nothing logs, and the screens all
-- work — because each one also fetches once on mount, so any navigation refreshes it
-- and hides the fact that the live path never fires. What is lost is exactly the
-- moment the product is built around: a relative on another phone adds what they
-- remember, and the owner, holding their own phone, sees nothing until they leave the
-- screen and come back.
--
-- RLS still applies. Realtime evaluates the subscriber's policies per row, so adding a
-- table here does not widen who can read what — it only allows rows a user could
-- already select to reach them without a refetch.

alter publication supabase_realtime add table public.memories;
alter publication supabase_realtime add table public.remarks;
alter publication supabase_realtime add table public.stories;
alter publication supabase_realtime add table public.notifications;

-- Default replica identity (primary key) is enough here. The client only reads the
-- new row and reloads from PostgREST, so nothing needs the pre-image that REPLICA
-- IDENTITY FULL exists to provide — and FULL writes every column of every row into
-- the WAL, which is a real cost on the memories table for no gain.
