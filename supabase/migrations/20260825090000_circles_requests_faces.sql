-- Circles, requests, and the names of people in photographs.
--
-- Three of the designed screens — Answer requests, Tag faces, Invite family — have
-- had nothing behind them, and the reason is one missing idea rather than three: this
-- app has no notion of a family. A memory has an owner and a set of anonymous
-- link-holders, so "the whole family can reply", "add someone to The Nawaz Family"
-- and a shared question with two answers all describe a group that does not exist.
--
-- This adds it, and draws the read boundary deliberately narrowly.
--
-- Joining a circle does NOT hand somebody your archive. A member can read exactly the
-- memories that were posted as answers to a question asked in that circle — you
-- answered something the family asked, so the family can see the answer. Everything
-- else you own stays yours, and the existing owner-only policies are untouched.
-- Widening that further is a product decision, not a migration.

/* ------------------------------------------------------------------ circles */

create table public.circles (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 60),
  -- Same shape and same alphabet as an invite token: unguessable, and readable
  -- aloud without confusing I for 1.
  invite_token text not null unique
                 check (invite_token ~ '^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{20}$'),
  created_at   timestamptz not null default now()
);

create index circles_owner_idx on public.circles (owner_id);

/*
 * Members, including people who are not on the app.
 *
 * `user_id` is nullable on purpose. "Zara — Cousin — Invite" in the design is someone
 * the family knows about and has not reached yet, and a members table that can only
 * hold accounts cannot represent her. A row with a name and no user is a seat kept
 * warm; joining fills it in.
 */
create table public.circle_members (
  id           uuid primary key default gen_random_uuid(),
  circle_id    uuid not null references public.circles (id) on delete cascade,
  user_id      uuid references auth.users (id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 60),
  relationship text check (char_length(relationship) <= 40),
  joined_at    timestamptz,
  created_at   timestamptz not null default now(),
  -- One seat per account per circle. Two rows for the same person is how a member
  -- list starts lying about how many people are in a family.
  unique (circle_id, user_id)
);

create index circle_members_circle_idx on public.circle_members (circle_id);
create index circle_members_user_idx on public.circle_members (user_id);

/**
 * Membership test, as a function.
 *
 * Security definer so the policies below can ask it without recursing: a policy on
 * circle_members that queries circle_members to decide who may read circle_members
 * is an infinite loop, and Postgres will say so at the worst possible moment.
 */
create or replace function public.is_circle_member(p_circle uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.circle_members m
     where m.circle_id = p_circle
       and m.user_id = auth.uid()
       and m.joined_at is not null
  ) or exists (
    select 1 from public.circles c
     where c.id = p_circle and c.owner_id = auth.uid()
  );
$$;

revoke all on function public.is_circle_member(uuid) from public;
grant execute on function public.is_circle_member(uuid) to authenticated;

alter table public.circles enable row level security;
alter table public.circle_members enable row level security;

create policy circles_select_member on public.circles
  for select to authenticated
  using (public.is_circle_member(id));

create policy circles_insert_own on public.circles
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy circles_update_owner on public.circles
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy circles_delete_owner on public.circles
  for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy circle_members_select on public.circle_members
  for select to authenticated
  using (public.is_circle_member(circle_id));

-- Only the circle's owner edits the seat list. Joining by link goes through an Edge
-- Function under the service role, because a client that could insert its own
-- membership could add itself to any circle whose id it could guess.
create policy circle_members_write_owner on public.circle_members
  for all to authenticated
  using (
    exists (select 1 from public.circles c
             where c.id = circle_id and c.owner_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.circles c
             where c.id = circle_id and c.owner_id = (select auth.uid()))
  );

/* ----------------------------------------------------------------- requests */

create table public.memory_requests (
  id         uuid primary key default gen_random_uuid(),
  circle_id  uuid not null references public.circles (id) on delete cascade,
  asked_by   uuid not null references auth.users (id) on delete cascade,
  -- Stored as the person wrote it, question mark and all. The design shows these in
  -- quotation marks precisely because they are somebody's words, not a form label.
  question   text not null check (char_length(question) between 3 and 200),
  created_at timestamptz not null default now(),
  closed_at  timestamptz
);

create index memory_requests_circle_idx
  on public.memory_requests (circle_id, created_at desc);

alter table public.memory_requests enable row level security;

create policy memory_requests_select on public.memory_requests
  for select to authenticated
  using (public.is_circle_member(circle_id));

create policy memory_requests_insert on public.memory_requests
  for insert to authenticated
  with check (
    asked_by = (select auth.uid()) and public.is_circle_member(circle_id)
  );

-- The asker closes their own question. Nobody edits somebody else's words.
create policy memory_requests_update_asker on public.memory_requests
  for update to authenticated
  using (asked_by = (select auth.uid()))
  with check (asked_by = (select auth.uid()));

create policy memory_requests_delete_asker on public.memory_requests
  for delete to authenticated
  using (asked_by = (select auth.uid()));

/*
 * A memory can be an answer to a question.
 *
 * Nullable, and almost always null: the ordinary way to add a memory has nothing to
 * do with a request. When it is set, it is what makes the memory visible to the rest
 * of the circle — see the policy below.
 */
alter table public.memories
  add column request_id uuid references public.memory_requests (id) on delete set null;

create index memories_request_idx on public.memories (request_id)
  where request_id is not null;

/*
 * The narrow widening.
 *
 * A circle member may read a memory only when it was posted as an answer to a
 * question asked in a circle they belong to. Not "members can read each other's
 * memories" — that would turn joining a family into a licence to browse somebody's
 * private archive, which is the opposite of what this product promises on every
 * other screen.
 */
create policy memories_select_circle_answer on public.memories
  for select to authenticated
  using (
    request_id is not null
    and exists (
      select 1 from public.memory_requests r
       where r.id = request_id
         and public.is_circle_member(r.circle_id)
    )
  );

-- Same rule for the words underneath an answer: readable exactly when the answer is.
create policy remarks_select_circle_answer on public.remarks
  for select to authenticated
  using (
    exists (
      select 1
        from public.memories m
        join public.memory_requests r on r.id = m.request_id
       where m.id = memory_id
         and public.is_circle_member(r.circle_id)
    )
  );

/* --------------------------------------------------------------- face names */

/*
 * Who is in a photograph.
 *
 * Names only. There is no face detection here and this migration does not pretend
 * otherwise: nothing scans an image, nothing counts faces, and there are no
 * coordinates. The product claim — "naming them keeps who's-who from being lost" — is
 * about the names, and the names are the part that survives when the last person who
 * recognised the face is gone. Boxes can arrive later without moving this data.
 */
create table public.face_names (
  id           uuid primary key default gen_random_uuid(),
  memory_id    uuid not null references public.memories (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 60),
  relationship text check (char_length(relationship) <= 40),
  created_at   timestamptz not null default now(),
  -- The same person named twice on one photograph is a list that has stopped being
  -- useful. Case-insensitive, because "Nani" and "nani" are one grandmother.
  unique (memory_id, name)
);

create index face_names_memory_idx on public.face_names (memory_id);

alter table public.face_names enable row level security;

-- Owner-only, in both directions. Naming people in a photograph is an act of
-- authorship over that photograph, and the photograph has one owner.
create policy face_names_all_own on public.face_names
  for all to authenticated
  using (
    exists (select 1 from public.memories m
             where m.id = memory_id and m.owner_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.memories m
             where m.id = memory_id and m.owner_id = (select auth.uid()))
  );

/* ------------------------------------------------- names inside a circle */

/*
 * A member can read the display name of the people in their circle.
 *
 * Without this the screens are technically correct and socially useless: every
 * question reads "Someone asked", every answer is "from Someone", because
 * `profiles_select_own` means an account can only ever read its own row. The one
 * thing a family screen must be able to do is say who.
 *
 * Deliberately scoped to shared circles rather than "any authenticated user", and it
 * exposes exactly what the other person chose to be called. The username, the bio and
 * the avatar path are not reachable through this — those stay on the owner-only
 * policy, and this one grants nothing on top of it.
 */
create or replace function public.shares_circle_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.circles c
      left join public.circle_members mine
             on mine.circle_id = c.id
            and mine.user_id = auth.uid()
            and mine.joined_at is not null
      left join public.circle_members theirs
             on theirs.circle_id = c.id
            and theirs.user_id = p_user
            and theirs.joined_at is not null
     where (c.owner_id = auth.uid() or mine.id is not null)
       and (c.owner_id = p_user or theirs.id is not null)
  );
$$;

revoke all on function public.shares_circle_with(uuid) from public;
grant execute on function public.shares_circle_with(uuid) to authenticated;

create policy profiles_select_circle on public.profiles
  for select to authenticated
  using (public.shares_circle_with(id));

/* ----------------------------------------------- the photograph behind an answer */

/*
 * A circle member can read the image file of an answer, exactly as they can read the
 * row.
 *
 * Found by running the flow across two accounts rather than by reading the policy:
 * the answer rendered — title, words, date, attribution — with "This image could not
 * be loaded" where the photograph belongs. Storage scopes reads to the caller's own
 * uid prefix, and an answer lives under the uid of whoever posted it.
 *
 * A memory without its photograph is not a memory, so a rule that shares the row and
 * withholds the picture shares nothing worth having. The condition below is the same
 * one the row policy uses, applied to the object path — object names are
 * `<owner_uid>/<memory_id>/original.jpg`, so the second segment is the memory.
 */
create policy memories_objects_select_circle_answer on storage.objects
  for select to authenticated
  using (
    bucket_id = 'memories'
    and exists (
      select 1
        from public.memories m
        join public.memory_requests r on r.id = m.request_id
       where m.id::text = (storage.foldername(name))[2]
         and public.is_circle_member(r.circle_id)
    )
  );
