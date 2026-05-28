-- Add regular media memories as a separate wall presentation from Memory Cards.
alter table public.wall_posts drop constraint if exists wall_posts_post_type_check;
alter table public.wall_posts add constraint wall_posts_post_type_check
  check (post_type in ('note', 'polaroid', 'media', 'song', 'movie', 'voice'));
