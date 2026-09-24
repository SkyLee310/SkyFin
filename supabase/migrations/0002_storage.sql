-- Receipts bucket (TECH_SPEC §4.3): private, JPEG only, 2 MB per object.
-- Objects live at {user_id}/{uuid}.jpg; each user reads, uploads and deletes only in their folder.
-- There is no update policy, so an upload can never overwrite an existing object.
-- Storage owns the grants on storage.objects; RLS below decides which rows each user reaches.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 2097152, array['image/jpeg']);

create policy "own receipts read" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own receipts insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own receipts delete" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
