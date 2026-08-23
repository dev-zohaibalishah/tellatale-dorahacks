# Cursor prompt — apply the editable-profiles migration

The app code for profile editing is already in the repo and typechecks clean. The one
thing missing is the database change, and I cannot reach your Supabase account — so
Cursor has to apply it.

Until this runs, the editor opens and renders correctly but saving shows
*"Could not find the 'bio' column of 'profiles' in the schema cache."*

Copy everything inside the fence into Cursor's chat (Agent mode, this repo open).

---

```
Apply one new database migration to my Supabase project and verify it worked.

Use the Supabase MCP connection. First run list_projects and confirm you are
operating on the project whose ref matches EXPO_PUBLIC_SUPABASE_URL in .env
(currently yrpdcumlqufgemfbnqlm). If it does not match, STOP and tell me.

## Step 1 — Apply the migration

Apply supabase/migrations/20260823120000_editable_profiles.sql using apply_migration,
with the migration name "editable_profiles". Send the file's contents exactly as they
are — do not rewrite, reorder or "improve" the SQL.

It does four things:
  - adds avatar_path, bio and location columns to public.profiles
  - adds length checks on bio (280) and location (60)
  - adds a check that avatar_path always starts with the row's own uid
  - creates a private `avatars` storage bucket with four uid-prefixed RLS policies

It is idempotent (add column if not exists / drop constraint if exists /
on conflict do update / drop policy if exists), so re-running it is safe.

## Step 2 — Verify

1. Confirm the columns exist:

   select column_name from information_schema.columns
   where table_schema='public' and table_name='profiles'
   order by column_name;

   Expect avatar_path, bio and location among the results.

2. Confirm the bucket:

   select id, public, file_size_limit, allowed_mime_types
   from storage.buckets where id='avatars';

   Expect public=false and file_size_limit=2097152.

3. Confirm the four policies exist:

   select policyname from pg_policies
   where tablename='objects' and policyname like 'avatars_%';

   Expect exactly four: select, insert, update, delete.

4. Run get_advisors with type "security". The new migration should add NOTHING.
   Anything it does add, show me before continuing.

## Step 3 — Prove it end to end

Sign in as the demo account and save a profile field over the real API:

  TOKEN=$(curl -s -X POST "<PROJECT_URL>/auth/v1/token?grant_type=password" \
    -H "apikey: <PUBLISHABLE_KEY>" -H "Content-Type: application/json" \
    -d '{"email":"abc@tellatale.app","password":"11223344"}' | jq -r .access_token)

  curl -s -X PATCH "<PROJECT_URL>/rest/v1/profiles?id=eq.<ABC_UID>" \
    -H "apikey: <PUBLISHABLE_KEY>" -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" -H "Prefer: return=representation" \
    -d '{"bio":"Keeper of old photographs.","location":"Lahore, Pakistan"}'

Expect the updated row back. Then set them both to null again so the demo account
starts clean.

## Rules

- Do not change any application code. It is already written and typechecks clean.
- Do not touch the other nine migrations.
- Do not create a new Supabase project.
- If a step fails, show me the actual error rather than working around it.
```

---

## What I already verified, so Cursor does not need to re-litigate it

I applied this exact SQL to the old project (`vaaoyltakckcdtkwfxph`, which still has
the full schema) and ran the cases inside a transaction that was rolled back:

| Check | Result |
|---|---|
| A normal name/bio/location edit | passes |
| `avatar_path` under the owner's own uid | passes |
| `avatar_path` pointing at another user's uid | **blocked** |
| A 281-character bio | **blocked** |
| A 280-character bio | passes |
| Renaming the username | **blocked** (the existing trigger still holds) |
| Clearing every field back to null | passes |

Storage came out as intended: bucket private, 2 MB ceiling, four policies. The
security advisor reported nothing new.

## The one thing to watch

Cursor may see `avatars_*` policies scoped to `authenticated` and offer to add an
`anon` read policy so avatars "work in shared links". Decline. Nothing in the app
renders another person's avatar today, and a public read policy on that bucket would
make every profile picture fetchable by anyone holding the publishable key — which is
in the app binary.
