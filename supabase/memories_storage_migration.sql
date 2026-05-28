-- Ensure public memory media uploads work in production, including voice notes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'Memories',
  'Memories',
  true,
  52428800,
  array[
    'image/jpg',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'audio/mp4',
    'audio/mpeg',
    'audio/aac',
    'audio/wav',
    'audio/x-caf'
  ]
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users can read memory media" on storage.objects;
drop policy if exists "Authenticated users can upload memory media" on storage.objects;
drop policy if exists "Authenticated users can update memory media" on storage.objects;
drop policy if exists "Authenticated users can delete memory media" on storage.objects;

create policy "Authenticated users can read memory media"
  on storage.objects for select to authenticated
  using (bucket_id = 'Memories');

create policy "Authenticated users can upload memory media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'Memories');
