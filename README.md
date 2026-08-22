# TellaTale

**Every photo holds more than one memory.**

A React Native app for turning one photograph into a shared, source-aware story: the
owner starts with their own account, the people who were there add theirs *without
creating an account*, and a composed narrative brings them together — without ever
displacing anyone's words or inventing a fact.

Built from three source documents: the StoryImage MVP spec (scope), the Heirloom PRD
v1.0 (guardrails, design tokens, threat model), and the Heirloom prototype
(interaction language).

---

## Architecture

| Layer | Technology |
|---|---|
| Client | React Native · Expo SDK 57 · TypeScript · Expo Router |
| Identity, data, media, server logic | **Supabase** — Postgres + RLS, Storage, Edge Functions |
| Push notifications only | **Firebase** — FCM HTTP v1, server-side |

Firebase is **not** the database. It does exactly one job: delivering pushes. The
service account never leaves the server, and no Firebase SDK ships in the app bundle.

**The repository seam.** No screen imports a backend SDK. Everything goes through
[`src/data/repository.ts`](src/data/repository.ts), which has two implementations —
Supabase and an on-device AsyncStorage adapter. That is what made moving off Firebase
a contained change rather than a rewrite: not one screen moved.

---

## Run it

```bash
npm install && npx expo start
```

`.env` already points at the hosted Supabase project. With no `.env` at all the app
falls back to on-device local mode and still runs — the owner flow works fully, only
cross-device guest contribution needs the backend.

### Accounts

Username + password, via Supabase Auth. Passwords are bcrypt-hashed by Auth and never
written to a table — `profiles` holds the username and display name only.

A username maps deterministically onto a synthetic address (`abc` → `abc@tellatale.app`),
so sign-in needs no lookup and there is no endpoint a stranger can poll to discover
whether a username exists. Sign-in returns one message for both a wrong password and
an unknown username, for the same reason.

**Test account:** `abc` / `11223344` — demo only. Eight digits with no entropy; do
not carry it past the demo. New signups require at least 8 characters.

No dashboard toggles are needed. Anonymous sign-in is deliberately unused.

### Fully offline stack

Needs Docker, which is why this build uses the hosted project instead:

```bash
npx supabase start && npx supabase db push
```

---

## Backend layout

```
supabase/
  migrations/           schema, guards, RLS, storage bucket
  functions/
    guest-memory/       read a memory by invite token   (no JWT)
    submit-remark/      a guest adds their account      (no JWT)
    add-reaction/       three fixed reactions           (no JWT)
    compose-story/      owner-only composition          (JWT)
    _shared/            service-role client, composer, FCM sender
```

Guest endpoints run without a JWT because contributors have no account — the product's
central friction removal. The **invite token is the credential**, so each endpoint
validates its shape, rate-limits the caller, and resolves it server-side under the
service role. Guests get no table access at all: an RLS policy able to match on a
token would have to let anonymous callers read rows to test it, turning the token into
an oracle.

### Composition

`compose-story` picks its provider from configuration, never from the caller:

```bash
npx supabase secrets set STORYIMAGE_COMPOSER_URL=https://your-composer
```

It receives a `ComposeRequest` and must return the `ComposedStory` shape — both in
[`shared/story.ts`](shared/story.ts), field for field from the MVP spec. Unset, a
deterministic composer runs instead: it *arranges* prose people already wrote and
derives uncertainty structurally, so invention is impossible by construction.

### Push

```bash
npx supabase secrets set FIREBASE_SERVICE_ACCOUNT="$(cat service-account.json)"
```

Devices register their FCM token into `push_tokens` (RLS: you can only touch your
own). `submit-remark` notifies the owner when someone contributes, and prunes tokens
FCM reports as permanently dead. Delivery is best-effort — a failed push never fails
the write that triggered it.

---

## Where the trust claims are enforced

The pitch is that the AI does not invent a family's past. Prompts are guidance; these
are the boundaries. **All 21 verified by integration test.**

| Claim | Enforced by |
|---|---|
| The owner's words are never rewritten | `guard_memory_update` trigger; composer output is overwritten with the stored original |
| A contributor's words are never edited | `guard_remark_update` — the owner may exclude or delete, never rewrite |
| No invented witnesses | Perspectives not matching a real included remark are dropped |
| Certainty is the contributor's own claim | Model-returned certainty discarded, theirs restored |
| No invented proper nouns | Narrative nouns diffed against input; violation falls back to deterministic |
| No identifying people from the image | Observations asserting identity are dropped, not softened |
| Excluded remarks stay private | Never sent to the composer at all |
| Nothing is public without approval | `public_requires_approval` **check constraint** — not a code path |
| Withdrawing approval unpublishes | `sync_story_approval` trigger forces `visibility = 'private'` |
| Composed fields are server-owned | `guard_story_update` — only `ownerEdited*` and `approvedAt` move |
| A leaked link is not an open endpoint | `consume_rate_limit`, revoked from `anon`/`authenticated` |
| Guests never learn the token or owner | Verified: neither appears in the guest payload |

---

## Dashboard

Three tabs, and the split is a product statement rather than a filing system:

| Tab | What it holds |
|---|---|
| Memories | Photographs you started, and are waiting on other people for |
| Shared with me | Photographs someone else started that you spoke into |
| Collections | Named groupings across both; a memory can sit in several |

The stat strip leads with **Voices collected**, not memories. A count of photographs
is a storage metric and this is not a storage product.

**Shared with me has an honest limit.** Contributing never requires an account, so a
remark carries `author_id` only when the contributor happened to be signed in.
Anonymous contributions cannot be listed back to anyone — that is the cost of the
account-free path, and the empty state says so rather than looking broken.

A contributor cannot read the `memories` row directly: it holds `invite_token`, and
any policy exposing it would hand out the write credential. Reads go through the
security-definer `memories_shared_with_me()`, whose column list omits both the token
and the owner id.

---

## Known gaps

- **Username/password, not phone OTP.** The PRD makes phone primary for the Elder
  persona and for South Asia. Supabase supports it but needs a paid SMS provider —
  Phase 0.
- **No password reset.** There is no email on file to send one to, which is the cost
  of not asking for an email. A recovery answer is needed before real users.
- **No link domain.** Until `EXPO_PUBLIC_LINK_HOST` points at a host serving App
  Links / Universal Links, invites use the app scheme and only open on a device that
  already has TellaTale. The invite screen says so rather than failing silently.
- **Invite tokens cannot be revoked.** PRD §8.3 specifies rotation; not built.
- **Push needs a dev build.** Expo Go cannot receive remote push; registration no-ops
  there and reports why instead of throwing.
- **`imageObservations` is empty** without a vision-capable composer. The card says
  the image was not analysed rather than inventing an observation.
- **Delete the `selftest` Edge Function.** It has been emptied and JWT-gated, but the
  slug remains: Edge Functions → selftest → Delete.

---

## The demo

One photo. Three people. Two of them remember the date differently.

The composed story keeps both, attributed — *"Memories differ on when this was: the
owner remembers it as 1987, Faisal remembers it as 1988"* — and never picks a winner.
That is the whole product in one screen, and it is why the uncertainty layer sits
above the narrative rather than in a footnote.
