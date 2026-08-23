# Cursor prompt — move TellaTale to my own Supabase account

Copy everything inside the fence into Cursor's chat (Agent mode, with this repo open).

---

```
You are migrating this Expo/React Native app (TellaTale) onto MY Supabase account.
Do the whole thing yourself. Do not ask me to run commands unless a step genuinely
requires a browser or a password only I have — in that case, stop, tell me exactly
what to click, and wait.

Use the Supabase MCP connection for my account. Confirm which account you are on
before doing anything destructive: run list_organizations and show me the result. If
the organisation is not "Zohaib Ali Shah", STOP and tell me — you are on the wrong
account.

## Step 1 — Create the project

Create a NEW, EMPTY Supabase project. Do not reuse an existing one: the schema
creates tables at fixed names and will collide with anything already there.

  name:   tellatale
  region: ap-south-1        (Mumbai — closest to Pakistan. Region cannot be
                             changed later, so do not accept a default.)

Call get_cost and confirm_cost first and tell me the price before creating.

## Step 2 — Apply the schema

Apply every file in supabase/migrations/ IN FILENAME ORDER, each as its own
migration with apply_migration, using the filename (minus the timestamp) as the
migration name. There are 10 of them. Do not skip any and do not reorder them —
20260821230559_fix_is_service_role_execute.sql repairs a mistake made by
20260821215746_harden_functions.sql, and applying them out of order leaves every
client insert broken.

Do NOT use supabase/bootstrap/schema.sql. That file exists for pasting into the
SQL editor by hand; going through the migrations keeps the project's migration
history correct so `supabase db push` works later.

After applying, run get_advisors with type "security". Expect exactly ONE result: an
INFO note that public.rate_limits has RLS enabled with no policies. That is
deliberate — it denies every client role and leaves the table to the service role.
If you see anything else, show me before continuing.

## Step 3 — Deploy the Edge Functions

Deploy all five from supabase/functions/ using deploy_edge_function. Each needs its
shared dependencies included in the files array (they import from ./_shared/).

  guest-memory    verify_jwt: false
  submit-remark   verify_jwt: false     (imports _shared/admin.ts and _shared/fcm.ts)
  add-reaction    verify_jwt: false
  auth-signup     verify_jwt: false
  compose-story   verify_jwt: TRUE      (imports _shared/admin.ts and _shared/compose.ts)

The four `false` values are correct and intentional. A contributor to a memory has no
account — that is the core of the product. The invite token is the credential, and
each of those functions validates its shape, rate-limits the caller, and resolves it
server-side under the service role. Do not "fix" them to true; that breaks the guest
flow completely.

## Step 4 — Point the app at the new project

Get the project URL and the publishable key (get_project_url, get_publishable_keys —
use the key whose type is "publishable", not the legacy anon JWT).

Update BOTH of these files. Both, not one:

  .env                        EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
  eas.json  -> build.base.env  the same two values

eas.json matters because .env is gitignored. A build triggered from GitHub clones a
repo with no .env, and this app treats missing Supabase config as "run on device
only" — it would install, open, look completely correct, and have no backend. That
has already happened once on this project.

NEVER put the service role key in either file, or in anything prefixed
EXPO_PUBLIC_. Anything with that prefix is compiled into the app binary.

## Step 5 — Verify it actually works

Do not report success from the fact that commands returned 200. Prove it:

1. Create the demo account through the real signup endpoint:

   curl -s -X POST "<PROJECT_URL>/functions/v1/auth-signup" \
     -H "apikey: <PUBLISHABLE_KEY>" -H "Content-Type: application/json" \
     -d '{"username":"abc","password":"11223344","displayName":"Abc"}'

   Expect {"ok":true,...}. Then query the profiles table and confirm the row exists.

2. Sign in and confirm you get an access_token:

   curl -s -X POST "<PROJECT_URL>/auth/v1/token?grant_type=password" \
     -H "apikey: <PUBLISHABLE_KEY>" -H "Content-Type: application/json" \
     -d '{"email":"abc@tellatale.app","password":"11223344"}'

3. Confirm the guest endpoint rejects a bad token with 404 and the message
   "This link is not valid.":

   curl -s -X POST "<PROJECT_URL>/functions/v1/guest-memory" \
     -H "apikey: <PUBLISHABLE_KEY>" -H "Content-Type: application/json" \
     -d '{"token":"ABCDEFGHJKMNPQRSTVWX"}'

4. Run: npx tsc --noEmit        (must be clean)
5. Run: npx expo-doctor@latest  (must be 21/21)

## Step 6 — Commit

Commit and push to main. Message should say which project ref the app now points at.

## Rules

- Read every file before editing it. I also work in this repo.
- Do not invent data. If something has no backend yet (face tagging, memory
  requests, like counts), leave it as it is — the screens already say so honestly.
- Do not change the app's UI, schema, or product behaviour. This task is only
  moving the backend to a different Supabase project.
- If a step fails, show me the actual error. Do not retry silently or work around it.
```

---

## What I already did, so Cursor does not repeat it

- **Old project wiped.** Every row and every uploaded image deleted from
  `vaaoyltakckcdtkwfxph`. Schema left intact so it still runs until you swap keys.
- **Migrations are in the repo** — all 10, matching what was applied, in order.
- **Edge Function sources are in the repo** — all 5, plus `_shared/`.
- **`supabase/config.toml`** already declares the per-function `verify_jwt` values.

## The one thing to watch

Cursor will be tempted to set `verify_jwt: true` on the guest functions, because that
looks like the safe choice. It is the wrong one here and it silently kills the
account-free contribution flow — the single feature the whole product is built
around. The prompt says so twice for that reason.
