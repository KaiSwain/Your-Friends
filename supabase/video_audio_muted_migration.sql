alter table public.wall_posts add column if not exists video_muted boolean not null default false;
alter table public.contacts add column if not exists avatar_video_muted boolean not null default false;
