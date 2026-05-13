-- Repair private-note photo uploads for the live Supabase project.
-- Run this in Supabase Dashboard -> SQL Editor for the project used by the app.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'private_notes',
  'private_notes',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read own private note media" on storage.objects;
drop policy if exists "Users can upload own private note media" on storage.objects;
drop policy if exists "Users can update own private note media" on storage.objects;
drop policy if exists "Users can delete own private note media" on storage.objects;

create policy "Users can read own private note media"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'private_notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can upload own private note media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'private_notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update own private note media"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'private_notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'private_notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete own private note media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'private_notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Verification: this should return one bucket row and four policy rows.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'private_notes';

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname in (
    'Users can read own private note media',
    'Users can upload own private note media',
    'Users can update own private note media',
    'Users can delete own private note media'
  )
order by policyname;