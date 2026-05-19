create table if not exists public.profile_wall_items (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  wall_post_id uuid not null references public.wall_posts(id) on delete cascade,
  replies_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  constraint profile_wall_items_unique unique (owner_user_id, wall_post_id)
);

alter table public.profile_wall_items
  add column if not exists replies_hidden boolean not null default false;

alter table public.profile_wall_items enable row level security;

drop policy if exists "Users can read own profile wall items" on public.profile_wall_items;
drop policy if exists "Friends can read profile wall items" on public.profile_wall_items;
drop policy if exists "Users can insert own profile wall items" on public.profile_wall_items;
drop policy if exists "Users can delete own profile wall items" on public.profile_wall_items;

create policy "Users can read own profile wall items"
  on public.profile_wall_items
  for select
  using (auth.uid() = owner_user_id);

create policy "Friends can read profile wall items"
  on public.profile_wall_items
  for select
  using (
    exists (
      select 1 from public.friendships f
      where (f.user_low_id = auth.uid() and f.user_high_id = owner_user_id)
         or (f.user_high_id = auth.uid() and f.user_low_id = owner_user_id)
    )
  );

create policy "Users can insert own profile wall items"
  on public.profile_wall_items
  for insert
  with check (auth.uid() = owner_user_id);

create policy "Users can delete own profile wall items"
  on public.profile_wall_items
  for delete
  using (auth.uid() = owner_user_id);

drop policy if exists "Friends can read featured profile wall posts" on public.wall_posts;

create policy "Friends can read featured profile wall posts"
  on public.wall_posts
  for select
  using (
    exists (
      select 1
      from public.profile_wall_items pwi
      join public.friendships f
        on (f.user_low_id = auth.uid() and f.user_high_id = pwi.owner_user_id)
        or (f.user_high_id = auth.uid() and f.user_low_id = pwi.owner_user_id)
      where pwi.wall_post_id = wall_posts.id
    )
  );

create index if not exists idx_profile_wall_items_owner_created
  on public.profile_wall_items(owner_user_id, created_at desc);

create index if not exists idx_profile_wall_items_wall_post
  on public.profile_wall_items(wall_post_id);
