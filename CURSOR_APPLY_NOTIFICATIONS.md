# Cursor prompt — apply the notifications and realtime migrations

Two new migrations. The app code is already committed and typechecks clean; until
these run, the notifications screen shows an error and nothing arrives live.

Copy everything inside the fence into Cursor's chat (Agent mode, this repo open).

---

```
Apply two new database migrations to my Supabase project and verify them.

Use the Supabase MCP connection. First run list_projects and confirm you are on the
project whose ref matches EXPO_PUBLIC_SUPABASE_URL in .env — currently
yrpdcumlqufgemfbnqlm. If it does not match, STOP and tell me.

git pull first. The last commit should be 9638488 or newer.

## Step 1 — Apply, in this order

  supabase/migrations/20260824090000_notifications.sql
  supabase/migrations/20260824093000_enable_realtime.sql

Use apply_migration, one call each, names "notifications" and "enable_realtime".
Send each file's contents exactly as written — do not rewrite or reorder the SQL.

The first creates public.notifications, its RLS policies, an update guard, two
trigger functions that write a row when a remark or a reaction lands, and the
mark_notifications_read() RPC.

The second adds memories, remarks, stories and notifications to the
supabase_realtime publication. This is not optional and it is not a nicety: the app
has four postgres_changes subscriptions that have been connecting and receiving
nothing, because the publication was empty. RLS still applies to realtime, so this
does not widen who can read what.

## Step 2 — Verify the shape

1. select count(*) from public.notifications;            -- should run, expect 0
2. select tablename from pg_publication_tables
     where pubname = 'supabase_realtime' order by tablename;
   Expect exactly four: memories, notifications, remarks, stories.
3. select proname, prosecdef from pg_proc
     where proname in ('notify_owner_of_remark','notify_owner_of_reaction',
                       'mark_notifications_read');
   All three must show prosecdef = true (security definer).
4. get_advisors with type "security". The new migration should add NOTHING beyond
   what was already there. Show me anything it does add.

## Step 3 — Prove the trigger fires

Insert a remark against one of my existing memories and confirm a notification
appears, then remove both so my data is left as it was:

  -- pick any memory id of mine
  select id, title from public.memories limit 1;

  -- service-role context, so the derived-count guard permits the insert
  select set_config('request.jwt.claims', '{"role":"service_role"}', true);
  insert into public.remarks (memory_id, author_id, contributor_name, body, certainty, included)
  values ('<THAT_ID>', null, 'Trigger Test', 'Checking the notification trigger.', 'certain', true)
  returning id;

  select kind, actor_name, preview, created_at from public.notifications;

Expect exactly one row, kind 'remark_added', actor_name 'Trigger Test'. Then delete
that remark by the id it returned, and delete the notification row. Show me the
counts afterwards so I can see my data is untouched.

## Step 4 — Report back

Tell me the four publication tables and the notification row you saw before deleting
it. Then I will open the app and check the bell.

## Rules

- Do not modify application code. It is committed and verified.
- Do not change .env, eas.json, or any credential.
- Do not add an INSERT policy to notifications. There deliberately is none — a client
  that can write its own notifications can forge "someone added to your memory",
  which is the one claim this table exists to make truthfully. The triggers are
  security definer precisely so guests with no account can still cause a row.
- Do not set REPLICA IDENTITY FULL. Default is correct here and FULL writes every
  column of every row into the WAL for no benefit.
- If a step fails, show me the actual error rather than working around it.
```

---

## What I already verified, so Cursor need not re-litigate it

Applied to a throwaway project and exercised end to end:

| Check | Result |
|---|---|
| Guest remark creates a notification for the owner | yes |
| Owner contributing to their own memory notifies them | no — correct |
| Reaction creates a notification | yes |
| Preview carries the contributor's words | yes |
| Notification timestamp matches the remark, not the trigger clock | yes |
| Owner can mark read | 4 unread → 0 |
| Owner rewriting actor_name | blocked |
| Client inserting a notification | blocked |
| A stranger reading or marking them | 0 rows |

And in the app: four notifications grouped Today / Yesterday / This week, unread
count on the bell, marked read on leaving the screen, a fifth contribution inserted
server-side picked up on the next focus.

## The one thing to watch

Cursor may see `notifications` with no INSERT policy and offer to add one "so the app
can create notifications". Decline. Nothing in the app creates them — the database
does, from triggers, which is what makes the contents trustworthy.
