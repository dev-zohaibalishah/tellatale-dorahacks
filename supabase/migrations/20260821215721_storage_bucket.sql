-- Private bucket. Owners read and write only under their own uid prefix; guests
-- never get a storage policy at all and instead receive a short-lived signed URL
-- minted by the guest Edge Function. No client ever holds a permanent media URL.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'memories',
  'memories',
  false,
  12582912,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Object paths are `<uid>/<memory_id>/original.jpg`, so the first path segment is
-- the ownership check.
create policy memories_objects_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy memories_objects_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy memories_objects_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy memories_objects_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
