alter table public.wall_posts add column if not exists memory_date date;

create index if not exists wall_posts_memory_date_idx
  on public.wall_posts (memory_date desc, created_at desc);
