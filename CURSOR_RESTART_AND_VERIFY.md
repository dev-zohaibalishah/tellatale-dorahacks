# Cursor prompt — restart on a clean bundle and finish the pending work

Copy everything inside the fence into Cursor's chat (Agent mode, this repo open).

---

```
Restart this Expo project on a clean bundle and finish two pending items. Run the
commands yourself in the terminal. This is a Windows machine, so use PowerShell
syntax — no && chaining, no bash-isms.

## Why this is needed

My phone shows "That username and password do not match" when signing in, and the
credentials are correct. The cause is already diagnosed, so do not go looking for a
bug in the auth code:

EXPO_PUBLIC_* values are inlined into the JavaScript bundle when Metro builds it —
they are not read at runtime. A Metro process started before the Supabase project
changed keeps serving a bundle pointed at the OLD project, which is now empty, and an
empty database answers "Invalid login credentials" — byte for byte what a wrong
password returns. There is a stale node process holding port 8081 doing exactly this.

Verified working already: abc / 11223344 authenticates against
yrpdcumlqufgemfbnqlm. Do not change any auth code, and do not reset that password.

## Step 1 — Get the latest code

git pull

The last commit should be 97eb67b or newer. It fixes the Android status-bar overlap
and adds a dev-only backend indicator to the sign-in screen. If pulling conflicts
with local edits, show me the conflict rather than resolving it yourself.

## Step 2 — Kill every stale Metro

Free port 8081 and 8082. Do not skip this — the stale process is the whole problem:

  Get-NetTCPConnection -LocalPort 8081,8082 -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

Then confirm both are actually free:

  Get-NetTCPConnection -LocalPort 8081,8082 -State Listen -ErrorAction SilentlyContinue

That must print nothing.

## Step 3 — Start Metro with the cache cleared

  npx expo start --clear

--clear is required. Without it Metro reuses the transform cache and can serve the
old inlined environment even after a restart.

## Step 4 — Check the right backend is baked in

When the app opens on my phone, the sign-in screen now prints a dev-only line at the
bottom. Ask me what it says. It must read:

  dev · backend yrpdcumlqufgemfbnqlm

If it says vaaoyltakckcdtkwfxph, the bundle is still stale — go back to step 2. If it
says "no backend configured", .env is not being loaded; show me the Metro startup
output, which lists which EXPO_PUBLIC_ variables it exported.

Then I will sign in as abc / 11223344 and tell you whether it worked.

## Step 5 — Apply the migration that is still pending

The profile columns have never been applied to my Supabase project. Until they are,
the profile editor opens and renders correctly but saving fails with "Could not find
the 'bio' column of 'profiles' in the schema cache", and the app logs two 400s.

Follow CURSOR_APPLY_PROFILE_MIGRATION.md in this repo. It is a complete prompt with
its own verification steps. The migration file is
supabase/migrations/20260823120000_editable_profiles.sql and it is idempotent, so
re-running it is safe.

## Step 6 — Rebuild the dev build (native config changed)

The Android window and splash background changed in app.config.ts. That is native
configuration, so a Metro restart does NOT pick it up — it needs a new build:

  npx eas build --profile development --platform android

Ask me before starting this. It costs build minutes and takes a while. If I say no,
just tell me that the launch will still flash dark navy until I rebuild, and that
everything else in this list works without it.

## Rules

- Do not modify application code. The fixes are already committed and verified.
- Do not change .env, eas.json, or any Supabase credential.
- Do not "fix" the auth error handling — the ambiguous message is deliberate, so
  sign-in cannot be used to discover whether a username exists.
- If a command fails, show me the actual output. Do not retry silently.
```

---

## What this is fixing, in one line each

| Symptom | Cause | Step |
|---|---|---|
| Sign-in rejects correct credentials on the phone | stale Metro on 8081 serving the old project | 2–3 |
| Saving a profile fails | migration never applied to your project | 5 |
| Launch flashes dark navy | native splash colour, needs a rebuild | 6 |
| Content under the status bar | already fixed in code | 1 |

## The one that is easy to get wrong

Step 2 matters more than it looks. `npx expo start --clear` on a **new** port leaves
the old Metro running on 8081, and a phone that was already connected reconnects to
the one it knows. The stale bundle wins, the symptom survives the fix, and it looks
like the restart did nothing.
