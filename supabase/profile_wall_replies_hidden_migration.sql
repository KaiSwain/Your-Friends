alter table public.profile_wall_items
  add column if not exists replies_hidden boolean not null default false;
alter table public.profile_wall_items
  add column if not exists replies_hidden boolean not null default false;

drop policy if exists "Users can update own profile wall items" on public.profile_wall_items;

create policy "Users can update own profile wall items"
  on public.profile_wall_items
  for update
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);
