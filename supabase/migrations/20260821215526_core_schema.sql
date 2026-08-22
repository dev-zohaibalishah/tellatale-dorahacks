-- TellaTale core schema.
--
-- Shape mirrors shared/story.ts. Postgres uses snake_case; the repository adapter
-- maps to the camelCase domain types, and that mapping is the only place the two
-- vocabularies meet.
--
-- Two structural decisions worth stating:
--
--   * `stories` is keyed by memory_id, not its own id. There is exactly one current
--     story per memory. Regeneration replaces it; history is not kept, because an
--     un-approved older draft has no meaning to anyone.
--   * `invite_token` is unique and indexed. Guest access is a token lookup performed
--     by an Edge Function under the service role — never by a client — so the token
--     is never exposed to a reader who does not already hold it.

create extension if not exists pgcrypto;

/* ----------------------------------------------------------------- enums */

create type memory_type as enum (
  'family', 'friendship', 'travel', 'celebration', 'community', 'work'
);

-- The contributor's own claim about their memory. 'think' renders as "I think",
-- 'unsure' as "not sure" — wording fixed by the MVP spec.
create type certainty as enum ('certain', 'think', 'unsure');

create type visibility as enum ('private', 'public');

create type reaction_kind as enum ('broughtBack', 'learned', 'wantToAdd');

/* -------------------------------------------------------------- memories */

create table public.memories (
  id                      uuid primary key default gen_random_uuid(),
  owner_id                uuid not null references auth.users (id) on delete cascade,
  title                   text not null check (char_length(title) between 1 and 120),
  memory_type             memory_type not null,
  image_path              text not null,
  image_width             integer,
  image_height            integer,
  -- The owner's words. Immutable through the client; see the guard trigger.
  original_remark         text not null check (char_length(original_remark) between 1 and 2000),
  date_hint               text check (char_length(date_hint) <= 80),
  location_hint           text check (char_length(location_hint) <= 120),
  visibility              visibility not null default 'private',
  invite_token            text not null unique check (invite_token ~ '^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{20}$'),
  contributor_count       integer not null default 0 check (contributor_count >= 0),
  story_approved_at       timestamptz,
  -- The uploader's attestation that they may share this image. Required at insert.
  permission_confirmed_at timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  -- A memory cannot be public without an approved story. Enforced as data, not as a
  -- code path, so no future endpoint can route around it.
  constraint public_requires_approval
    check (visibility = 'private' or story_approved_at is not null)
);

create index memories_owner_created_idx
  on public.memories (owner_id, created_at desc);

/* --------------------------------------------------------------- remarks */

create table public.remarks (
  id               uuid primary key default gen_random_uuid(),
  memory_id        uuid not null references public.memories (id) on delete cascade,
  -- Null for guests. Contributing without an account is the point.
  author_id        uuid references auth.users (id) on delete set null,
  contributor_name text not null check (char_length(contributor_name) between 1 and 60),
  relationship     text check (char_length(relationship) <= 60),
  body             text not null check (char_length(body) between 1 and 2000),
  certainty        certainty not null,
  date_hint        text check (char_length(date_hint) <= 80),
  location_hint    text check (char_length(location_hint) <= 120),
  -- The owner curates by exception: included by default, excluded deliberately.
  included         boolean not null default true,
  created_at       timestamptz not null default now()
);

create index remarks_memory_created_idx
  on public.remarks (memory_id, created_at);

/* --------------------------------------------------------------- stories */

create table public.stories (
  memory_id          uuid primary key references public.memories (id) on delete cascade,
  title              text not null,
  summary            text not null default '',
  -- Echo of the owner's account. Written server-side from the stored original, never
  -- from whatever the composer returned.
  owner_memory       text not null,
  -- [{ contributorName, text, certainty }] — wire names frozen to the MVP spec.
  perspectives       jsonb not null default '[]'::jsonb,
  image_observations text[] not null default '{}',
  uncertainties      text[] not null default '{}',
  story              text not null,
  provider           text not null check (provider in ('existing', 'local')),
  ai_assisted        boolean not null default false,
  source_remark_ids  uuid[] not null default '{}',
  -- Set only by the approve path. Publishing depends on it.
  approved_at        timestamptz,
  -- Owner edits live beside the composed fields, never on top of them, so
  -- regeneration is non-destructive and the card can mark itself edited honestly.
  owner_edited_title text,
  owner_edited_story text,
  generated_at       timestamptz not null default now()
);

/* ------------------------------------------------------------- reactions */

create table public.reactions (
  id         uuid primary key default gen_random_uuid(),
  memory_id  uuid not null references public.memories (id) on delete cascade,
  kind       reaction_kind not null,
  created_at timestamptz not null default now()
);

create index reactions_memory_idx on public.reactions (memory_id);

/* ------------------------------------------------------------ push tokens */

-- Firebase is used for exactly one thing: delivering pushes. The token lives here,
-- next to the user it belongs to, so revocation follows account deletion for free.
create table public.push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  fcm_token  text not null unique,
  platform   text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);

/* ----------------------------------------------------------- rate limits */

-- Guest endpoints are reachable by anyone holding a link. Without a ceiling a leaked
-- link is an open write endpoint.
create table public.rate_limits (
  bucket     text primary key,
  count      integer not null default 0,
  expires_at timestamptz not null
);

create index rate_limits_expires_idx on public.rate_limits (expires_at);
