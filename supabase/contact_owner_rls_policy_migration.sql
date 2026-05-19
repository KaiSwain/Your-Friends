drop policy if exists "Users can manage own contacts" on public.contacts;

create policy "Users can manage own contacts"
  on public.contacts
  for all
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

drop policy if exists "Authors can manage own wall posts" on public.wall_posts;

create policy "Authors can manage own wall posts"
  on public.wall_posts
  for all
  using (auth.uid() = author_user_id)
  with check (auth.uid() = author_user_id);

drop policy if exists "Users can delete own friendships" on public.friendships;

create policy "Users can delete own friendships"
  on public.friendships
  for delete
  using (auth.uid() = user_low_id or auth.uid() = user_high_id);
