# Cursor prompt — apply every pending migration and rebuild

Five migrations are now waiting, and a native rebuild is required for dictation.
Copy everything inside the fence into Cursor's chat (Agent mode, this repo open).

---

```
Apply the pending database migrations to my Supabase project, then rebuild the
Android dev build. Run everything yourself. Windows machine — PowerShell syntax, no
&& chaining.

git pull first. The last commit should be daebef1 or newer.

Use the Supabase MCP connection. Run list_projects and confirm you are on the project
matching EXPO_PUBLIC_SUPABASE_URL in .env — currently yrpdcumlqufgemfbnqlm. If it
does not match, STOP.

## Step 1 — Apply these three, in this order

  supabase/migrations/20260824090000_notifications.sql
  supabase/migrations/20260824093000_enable_realtime.sql
  supabase/migrations/20260824120000_fix_story_approval.sql

One apply_migration call each, named "notifications", "enable_realtime" and
"fix_story_approval". Send each file's contents exactly as written.

Order matters: enable_realtime adds public.notifications to the publication, so it
has to run after the table exists.

## Step 2 — What each one is for

notifications — a table plus triggers on remarks and reactions. Replaces a screen
that inferred events from the memory list.

enable_realtime — the supabase_realtime publication was EMPTY, so four
postgres_changes subscriptions have been connecting and receiving nothing since the
app was built. RLS still applies; this does not widen access.

fix_story_approval — publishing has never worked. Approving sets
stories.approved_at, a trigger copies it to memories.story_approved_at, and
guard_memory_update rejected exactly that write, because is_service_role() reads JWT
claims and SECURITY DEFINER does not change them. So the trigger failed its own
guard, story_approved_at stayed null, and the public_requires_approval constraint
then refused every publish. This is why the Private / Anyone-with-the-link switch
appeared to do nothing.

## Step 3 — Verify

1. select tablename from pg_publication_tables where pubname='supabase_realtime'
   order by tablename;
   Expect exactly four: memories, notifications, remarks, stories.

2. Prove approval works, then undo it. Pick one of my memories that already has a
   story, or skip this and tell me if none has one:

   select m.id, m.title, s.approved_at
     from public.memories m join public.stories s on s.memory_id = m.id limit 1;

   Then, as the owner rather than as service role, confirm the chain:
   update public.stories set approved_at = now() where memory_id = '<ID>';
   select visibility, story_approved_at from public.memories where id = '<ID>';
   -- story_approved_at must now be set
   update public.memories set visibility = 'public' where id = '<ID>';
   -- must succeed
   Then put it back: update public.stories set approved_at = null where memory_id = '<ID>';
   That also resets visibility to private, by design. Show me the values at each step.

3. get_advisors with type "security". Show me anything new.

## Step 4 — The circles migration

  supabase/migrations/20260825090000_circles_requests_faces.sql
  supabase/migrations/20260825120000_fix_circle_insert.sql

Apply both, in that order, named "circles_requests_faces" and "fix_circle_insert".
The second is required: without it, creating a circle fails with "new row violates
row-level security policy". It adds circles,
circle_members, memory_requests, face_names, a request_id column on memories, and the
policies for all of them.

Read the header comment before you touch anything in it. The read boundary is drawn
deliberately narrowly: joining a circle lets a member read the memories posted as
answers to that circle's questions, and nothing else. Do not widen it to "members can
read each other's memories" — that turns joining a family into a licence to browse
somebody's private archive.

After applying, confirm with get_advisors type "security" and show me anything new.

## Step 5 — Redeploy guest-memory

The contributor screen now reads the accounts behind a published story, and the
function that serves them changed. Redeploy it:

  npx supabase functions deploy guest-memory

It must stay verify_jwt: false — a contributor has no account. supabase/config.toml
already declares that; do not pass a flag that overrides it.

Then check the gate holds. With one of my memories published, POST its token to
/functions/v1/guest-memory and confirm the response has an "accounts" array holding
the contributors. Set that memory back to private and POST again — "accounts" must be
empty and no contributor name may appear anywhere in the payload. Show me both
responses.

## Step 6 — Rebuild for dictation

"Speak it" now uses expo-speech-recognition. It is a native module and RECORD_AUDIO
is no longer blocked in app.config.ts, so Expo Go and the existing dev build cannot
run it — it needs a new build:

  npx eas build --profile development --platform android

Ask me before starting this; it costs build minutes. If I say no, tell me that
dictation will show its "needs a development build" state until I rebuild, and that
everything else works without it.

## Rules

- Do not modify application code. It is committed and verified.
- Do not change .env, eas.json, or any credential.
- Do not add an INSERT policy to notifications — the triggers write it, deliberately.
- Do not "simplify" the tellatale.syncing_approval flag out of the guard. It is the
  fix, and removing it re-breaks publishing.
- Do not re-block RECORD_AUDIO. Dictation needs it.
- If a step fails, show me the actual error rather than working around it.
```

---

## Already verified, so Cursor need not redo it

Against a throwaway project, through the real UI:

| Check | Result |
|---|---|
| Compose → approve → publish | works |
| Unapproving a story unpublishes it | works |
| Setting story_approved_at directly from a client | still blocked |
| Home filters partition | All 2 / Private 1 / Public 1 |
| "Public stories" filter when none are public | its own empty state, not the generic one |
| Contributor opening a published link | sees "a story has already been published" |
| Notification triggers, mark-read, forgery attempts | all as intended |

## What still needs your device

Dictation transcription itself. A headless browser cannot grant a microphone or
speak into one, so I verified the UI, the permission flow and the availability check,
not live speech-to-text. Test it on the phone after the rebuild.
