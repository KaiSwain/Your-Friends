create table if not exists public.friend_requests (
  id uuid primary key default uuid_generate_v4(),
  requester_user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_requests_not_self check (requester_user_id <> recipient_user_id),
  constraint friend_requests_unique_pair unique (requester_user_id, recipient_user_id)
);

alter table public.friend_requests enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'friend_requests' and policyname = 'Users can read involved friend requests') then
    create policy "Users can read involved friend requests"
      on public.friend_requests for select
      using (auth.uid() = requester_user_id or auth.uid() = recipient_user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'friend_requests' and policyname = 'Users can send friend requests') then
    create policy "Users can send friend requests"
      on public.friend_requests for insert
      with check (auth.uid() = requester_user_id and status = 'pending');
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'friend_requests' and policyname = 'Recipients can respond to friend requests') then
    create policy "Recipients can respond to friend requests"
      on public.friend_requests for update
      using (auth.uid() = recipient_user_id)
      with check (auth.uid() = recipient_user_id and status in ('accepted', 'declined'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'friend_requests' and policyname = 'Requesters can resend declined friend requests') then
    create policy "Requesters can resend declined friend requests"
      on public.friend_requests for update
      using (auth.uid() = requester_user_id and status = 'declined')
      with check (auth.uid() = requester_user_id and status = 'pending' and responded_at is null);
  end if;
end $$;

create index if not exists idx_friend_requests_recipient on public.friend_requests(recipient_user_id, status);
create index if not exists idx_friend_requests_requester on public.friend_requests(requester_user_id, status);

do $$
begin
  begin
    alter publication supabase_realtime add table public.friend_requests;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;
