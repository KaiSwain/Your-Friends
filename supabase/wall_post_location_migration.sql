-- Add optional manual location label to memories.
alter table public.wall_posts
  add column if not exists location_name text;

comment on column public.wall_posts.location_name is
  'Optional user-entered place name for this memory (e.g. Echo Park Lake).';
