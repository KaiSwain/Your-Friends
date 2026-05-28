-- Add lightweight image thumbnails for faster memory wall rendering.

alter table public.wall_posts
  add column if not exists image_thumb_path text;

comment on column public.wall_posts.image_thumb_path is
  'Optional lightweight thumbnail URL for fast memory wall rendering. Falls back to image_path when null.';
