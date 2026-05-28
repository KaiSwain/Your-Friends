-- Add Premium voice memories and voice prompt responses.

alter table public.wall_posts
  add column if not exists audio_path text;

alter table public.wall_posts
  add column if not exists audio_duration_ms integer;

alter table public.wall_posts
  drop constraint if exists wall_posts_post_type_check;

alter table public.wall_posts
  add constraint wall_posts_post_type_check
  check (post_type in ('note', 'polaroid', 'media', 'song', 'movie', 'voice'));

alter table public.wall_posts
  drop constraint if exists wall_posts_prompt_type_check;

alter table public.wall_posts
  add constraint wall_posts_prompt_type_check
  check (prompt_type is null or prompt_type in ('song', 'text', 'photo', 'photo_reference', 'voice'));

alter table public.memory_prompt_requests
  add column if not exists response_audio_path text;

alter table public.memory_prompt_requests
  add column if not exists response_audio_duration_ms integer;

alter table public.memory_prompt_requests
  drop constraint if exists memory_prompt_requests_prompt_type_check;

alter table public.memory_prompt_requests
  add constraint memory_prompt_requests_prompt_type_check
  check (prompt_type in ('song', 'text', 'photo', 'photo_reference', 'voice'));
