-- Approving a story has never worked from the client, and so publishing never has
-- either.
--
-- The chain: the owner sets `stories.approved_at`; `sync_story_approval` fires and
-- copies that onto `memories.story_approved_at`; `guard_memory_update` fires on that
-- update, sees `story_approved_at` changing, and raises "Approve the story itself,
-- not the memory."
--
-- The guard is right about the rule and wrong about who is speaking. It exempts the
-- service role via `is_service_role()`, which reads `request.jwt.claims` — a session
-- setting. `SECURITY DEFINER` changes the executing *user*, not the claims, so the
-- approval trigger runs with the owner's claims and fails its own guard. The single
-- code path that is supposed to set this column is the one path the guard blocks.
--
-- The visible symptom is not an error message. `approveStory` throws, the memory's
-- `story_approved_at` stays null, and the `public_requires_approval` check then
-- refuses every attempt to publish — so the Private / Anyone-with-the-link switch
-- simply never becomes usable, and it looks like a UI that does nothing.
--
-- Fixed with a transaction-local flag the approval trigger raises and the guard
-- honours. It is narrow on purpose: it names one column, it is set immediately
-- around one statement, and `set_config(..., true)` scopes it to the transaction, so
-- it cannot leak into an unrelated update later in the session.

create or replace function public.sync_story_approval()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Announce that the next memories update is this trigger's, not a client's.
  perform set_config('tellatale.syncing_approval', 'on', true);

  if new.approved_at is null then
    update public.memories
       set story_approved_at = null,
           -- Withdrawing approval unpublishes. A story the owner has taken back
           -- must not stay readable by everyone holding the link.
           visibility = 'private',
           updated_at = now()
     where id = new.memory_id;
  else
    update public.memories
       set story_approved_at = new.approved_at,
           updated_at = now()
     where id = new.memory_id;
  end if;

  perform set_config('tellatale.syncing_approval', 'off', true);
  return new;
end;
$$;

create or replace function public.guard_memory_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();

  if public.is_service_role() then
    return new;
  end if;

  if new.original_remark is distinct from old.original_remark then
    raise exception 'The original memory cannot be edited.' using errcode = '42501';
  end if;

  if new.invite_token is distinct from old.invite_token then
    raise exception 'Invite tokens cannot be changed from the client.' using errcode = '42501';
  end if;

  if new.owner_id is distinct from old.owner_id then
    raise exception 'Ownership cannot be transferred.' using errcode = '42501';
  end if;

  if new.image_path is distinct from old.image_path then
    raise exception 'The image cannot be swapped after creation.' using errcode = '42501';
  end if;

  if new.permission_confirmed_at is distinct from old.permission_confirmed_at then
    raise exception 'The permission attestation cannot be rewritten.' using errcode = '42501';
  end if;

  if new.contributor_count is distinct from old.contributor_count then
    raise exception 'contributor_count is derived.' using errcode = '42501';
  end if;

  -- Still forbidden from a client. The exemption is not "an authenticated user may
  -- set this"; it is "the approval trigger, mid-transaction, may". A client cannot
  -- raise this flag, because nothing grants it a way to run that trigger's body
  -- without also going through `stories.approved_at` — which is the intended door.
  if new.story_approved_at is distinct from old.story_approved_at
     and coalesce(current_setting('tellatale.syncing_approval', true), 'off') <> 'on' then
    raise exception 'Approve the story itself, not the memory.' using errcode = '42501';
  end if;

  return new;
end;
$$;
