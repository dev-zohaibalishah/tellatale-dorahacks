alter table public.memories    enable row level security;
alter table public.remarks     enable row level security;
alter table public.stories     enable row level security;
alter table public.reactions   enable row level security;
alter table public.push_tokens enable row level security;
alter table public.rate_limits enable row level security;

-- memories -------------------------------------------------------------------
-- Owner-only, in every direction. Guests never read this table directly: their
-- access is an invite-token lookup performed by an Edge Function under the service
-- role, which bypasses RLS. That is deliberate — a policy that could match on a
-- token would have to let an anonymous caller read rows to test it.

create policy memories_select_own on public.memories
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy memories_insert_own on public.memories
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy memories_update_own on public.memories
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy memories_delete_own on public.memories
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- remarks --------------------------------------------------------------------
-- The owner reads and curates. Inserts come from the guest Edge Function only, so
-- there is no client insert policy at all: a contributor cannot write here directly
-- even if they hold a valid token.

create policy remarks_select_owner on public.remarks
  for select to authenticated
  using (exists (
    select 1 from public.memories m
     where m.id = remarks.memory_id
       and m.owner_id = (select auth.uid())
  ));

create policy remarks_update_owner on public.remarks
  for update to authenticated
  using (exists (
    select 1 from public.memories m
     where m.id = remarks.memory_id
       and m.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.memories m
     where m.id = remarks.memory_id
       and m.owner_id = (select auth.uid())
  ));

create policy remarks_delete_owner on public.remarks
  for delete to authenticated
  using (exists (
    select 1 from public.memories m
     where m.id = remarks.memory_id
       and m.owner_id = (select auth.uid())
  ));

-- stories --------------------------------------------------------------------
-- Composition is server-side, so no client insert. The owner reads, edits their own
-- fields, and approves; the column guard trigger constrains which fields move.

create policy stories_select_owner on public.stories
  for select to authenticated
  using (exists (
    select 1 from public.memories m
     where m.id = stories.memory_id
       and m.owner_id = (select auth.uid())
  ));

create policy stories_update_owner on public.stories
  for update to authenticated
  using (exists (
    select 1 from public.memories m
     where m.id = stories.memory_id
       and m.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.memories m
     where m.id = stories.memory_id
       and m.owner_id = (select auth.uid())
  ));

-- reactions ------------------------------------------------------------------
-- Written by the guest Edge Function; the owner may read the tally.

create policy reactions_select_owner on public.reactions
  for select to authenticated
  using (exists (
    select 1 from public.memories m
     where m.id = reactions.memory_id
       and m.owner_id = (select auth.uid())
  ));

-- push tokens ----------------------------------------------------------------
-- A device registers its own token and may replace or revoke it. Nobody reads
-- anyone else's; the sender runs under the service role.

create policy push_tokens_select_own on public.push_tokens
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy push_tokens_insert_own on public.push_tokens
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy push_tokens_update_own on public.push_tokens
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy push_tokens_delete_own on public.push_tokens
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- rate_limits ----------------------------------------------------------------
-- Server-side bookkeeping. RLS is enabled with no policies, so every client role is
-- denied and only the service role (which bypasses RLS) can touch it.
