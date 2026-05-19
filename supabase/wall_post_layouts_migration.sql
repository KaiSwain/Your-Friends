create table if not exists public.wall_post_layouts (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  wall_context text not null,
  wall_context_id text not null,
  wall_post_id uuid not null references public.wall_posts(id) on delete cascade,
  x numeric not null default 0,
  y numeric not null default 0,
  scale numeric not null default 1,
  rotation numeric not null default 0,
  z_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wall_post_layouts_unique unique (owner_user_id, wall_context, wall_context_id, wall_post_id),
  constraint wall_post_layouts_context_check check (wall_context in ('contact_profile', 'shared_wall', 'my_profile', 'user_profile'))
);

alter table public.wall_post_layouts enable row level security;

drop policy if exists "Users can read own wall post layouts" on public.wall_post_layouts;
create policy "Users can read own wall post layouts"
  on public.wall_post_layouts
  for select
  using (auth.uid() = owner_user_id);

drop policy if exists "Users can insert own wall post layouts" on public.wall_post_layouts;
create policy "Users can insert own wall post layouts"
  on public.wall_post_layouts
  for insert
  with check (auth.uid() = owner_user_id);

drop policy if exists "Users can update own wall post layouts" on public.wall_post_layouts;
create policy "Users can update own wall post layouts"
  on public.wall_post_layouts
  for update
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

drop policy if exists "Users can delete own wall post layouts" on public.wall_post_layouts;
create policy "Users can delete own wall post layouts"
  on public.wall_post_layouts
  for delete
  using (auth.uid() = owner_user_id);

do $$
begin
  alter publication supabase_realtime add table public.wall_post_layouts;
exception
  when duplicate_object then null;
end $$;
