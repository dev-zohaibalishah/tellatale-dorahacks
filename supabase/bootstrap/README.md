# Moving TellaTale to your own Supabase account

Everything the backend needs, in the order it needs doing. Roughly ten minutes.

---

## 1. Make a project

Create a **new, empty** project rather than reusing an existing one. `schema.sql`
creates tables, types and policies at fixed names, and running it into a database that
already has its own tables will either collide or quietly sit next to data it knows
nothing about.

Two settings worth getting right at creation, because neither can be changed later:

| Setting | Suggestion |
|---|---|
| **Name** | `tellatale` — the slug ends up in dashboard URLs |
| **Region** | `ap-south-1` (Mumbai) for users in Pakistan/India |

Region is the one that matters. Every image upload, every guest opening an invite
link, and every Edge Function call makes a round trip to it. Seoul (`ap-northeast-2`)
is roughly three times further from Karachi than Mumbai, and it shows on photo
uploads over mobile data.

Save the **database password** somewhere — the CLI asks for it in step 3 and it
cannot be recovered, only reset.

---

## 2. Create the schema

Open **SQL Editor → New query**, paste the whole of [`schema.sql`](./schema.sql), run.

It is wrapped in a transaction: if anything fails, nothing is applied and you can fix
and re-run. On success you have 8 tables, the RLS policies, the guard triggers, both
storage buckets (`memories` and `avatars`), and the two dashboard functions.

Then check **Advisors → Security**. It should report one INFO note about
`rate_limits` having RLS enabled with no policies. That one is deliberate — it denies
every client role and leaves the table to the service role alone.

---

## 3. Deploy the Edge Functions

The SQL editor cannot do this; the CLI can.

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy
```

`supabase/config.toml` already declares which functions skip JWT verification, so
`deploy` picks up the right setting per function. Do not set them by hand.

Four of the five run **without** a JWT on purpose — `guest-memory`, `submit-remark`,
`add-reaction` and `auth-signup`. A contributor has no account, which is the whole
point of the product; the invite token is the credential, and each function validates
it, rate-limits the caller and resolves it server-side.

---

## 4. Secrets (optional)

Neither is required. Without them the app runs with a deterministic composer and no
push.

```bash
npx supabase secrets set STORYIMAGE_COMPOSER_URL=https://your-composer
npx supabase secrets set FIREBASE_SERVICE_ACCOUNT="$(cat service-account.json)"
```

`FIREBASE_SERVICE_ACCOUNT` is the only genuine secret in this project. It must never
appear in `.env`, in `eas.json`, or anywhere with an `EXPO_PUBLIC_` prefix — anything
with that prefix is compiled into the app binary.

---

## 5. Point the app at it

From **Project Settings → API**, take the URL and the publishable key. Put them in two
places:

**`.env`** — for local development:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

**`eas.json`** → `build.base.env` — for builds. This is not optional: `.env` is
gitignored, so a build triggered from GitHub clones a repo without it, and the app
treats missing config as "run on device only". It would install, open, look correct,
and have no backend.

The publishable key belongs in the repo for the same reason it is safe there: it is
compiled into the APK regardless, and access is decided by Row Level Security. The
service role key is a different thing entirely and appears nowhere.

---

## 6. Create your first account

No dashboard toggles. The app uses username + password, so just open it and sign up —
`auth-signup` creates the auth user and the profile row together.

To recreate the demo account:

```bash
curl -s -X POST "https://YOUR_REF.supabase.co/functions/v1/auth-signup" \
  -H "apikey: YOUR_PUBLISHABLE_KEY" -H "Content-Type: application/json" \
  -d '{"username":"abc","password":"11223344","displayName":"Abc"}'
```

That password is eight digits with no entropy. Fine for a demo, not for anything that
outlives it.

---

## What does not carry over

The old project's data stays where it is. Memories, accounts and uploaded images are
rows and objects in that database, not in this repo — a fresh project starts empty.
If anything in the old one is worth keeping, export it before you stop using it.
