-- Editable profiles.
--
-- The profiles table was created to solve one problem — mapping a username onto the
-- synthetic email Auth is keyed by — and it has carried nothing else since. This adds
-- the fields a person actually edits: a picture, a line about themselves, and where
-- they are.
--
-- Username stays immutable and the existing trigger keeps enforcing that. It is not a
-- display detail: it is baked into the synthetic address already issued to Auth, so
-- changing it here would silently break sign-in for that account.

alter table public.profiles
  add column if not exists avatar_path text,
  add column if not exists bio          text,
  add column if not exists location     text;

-- Bounded because these render inside fixed layouts, and because an unbounded text
-- column on a user-writable row is a storage-cost bug waiting to be found.
alter table public.profiles
  drop constraint if exists profiles_bio_length;
alter table public.profiles
  add constraint profiles_bio_length check (bio is null or char_length(bio) <= 280);

alter table public.profiles
  drop constraint if exists profiles_location_length;
alter table public.profiles
  add constraint profiles_location_length
    check (location is null or char_length(location) <= 60);

-- avatar_path must live under the owner's own uid prefix.
--
-- RLS already stops one person writing another's profile row, and storage policies
-- already stop them writing another's object — but neither stops a client pointing
-- its own avatar_path at somebody else's object path. Nothing today would leak from
-- that (a signed URL is only mintable by someone who can read the object), yet it is
-- the kind of dangling reference that becomes a leak the moment the bucket is made
-- public or an avatar is exposed on a shared memory. Cheaper to forbid now.
alter table public.profiles
  drop constraint if exists profiles_avatar_path_own_prefix;
alter table public.profiles
  add constraint profiles_avatar_path_own_prefix
    check (avatar_path is null or avatar_path like (id::text || '/%'));

/* ------------------------------------------------------------------ storage */

-- A separate bucket from `memories`, not a folder inside it.
--
-- The two have genuinely different rules: an avatar is small, square, replaced in
-- place, and deleted when the person clears it; a memory original is large, kept
-- forever, and deleted only with its row. Sharing one bucket would mean one size
-- limit and one MIME list serving both, and a `remove()` bug in either path able to
-- reach the other's files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  2097152,                              -- 2 MB; the client downscales to 512px first
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Object paths are `<uid>/avatar-<n>.jpg`, so the first segment is the owner check —
-- the same shape the memories bucket uses.
drop policy if exists avatars_select_own on storage.objects;
create policy avatars_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
