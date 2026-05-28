alter table public.wall_posts
  add column if not exists memory_prompt_request_id uuid,
  add column if not exists referenced_wall_post_id uuid references public.wall_posts(id) on delete set null,
  add column if not exists prompt_text text,
  add column if not exists prompt_type text;

alter table public.wall_posts drop constraint if exists wall_posts_prompt_type_check;
alter table public.wall_posts
  add constraint wall_posts_prompt_type_check check (prompt_type is null or prompt_type in ('song', 'text', 'photo', 'photo_reference'));

create table if not exists public.memory_prompt_requests (
  id uuid primary key default uuid_generate_v4(),
  requester_user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  prompt_type text not null check (prompt_type in ('song', 'text', 'photo', 'photo_reference')),
  prompt_text text not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  response_body text,
  response_song_provider text check (response_song_provider in ('apple', 'spotify')),
  response_song_provider_id text,
  response_song_title text,
  response_song_artist text,
  response_song_artwork_url text,
  response_song_preview_url text,
  response_song_external_url text,
  referenced_wall_post_id uuid references public.wall_posts(id) on delete set null,
  completed_wall_post_id uuid references public.wall_posts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint memory_prompt_requests_no_self check (requester_user_id <> recipient_user_id)
);

alter table public.memory_prompt_requests enable row level security;

drop policy if exists "Users can read involved memory prompt requests" on public.memory_prompt_requests;
create policy "Users can read involved memory prompt requests"
  on public.memory_prompt_requests for select
  using (auth.uid() = requester_user_id or auth.uid() = recipient_user_id);

drop policy if exists "Friends can create memory prompt requests" on public.memory_prompt_requests;
create policy "Friends can create memory prompt requests"
  on public.memory_prompt_requests for insert
  with check (
    auth.uid() = requester_user_id
    and requester_user_id <> recipient_user_id
    and status = 'pending'
    and exists (
      select 1 from public.friendships f
      where (f.user_low_id = requester_user_id and f.user_high_id = recipient_user_id)
         or (f.user_low_id = recipient_user_id and f.user_high_id = requester_user_id)
    )
  );

drop policy if exists "Requesters can cancel pending memory prompt requests" on public.memory_prompt_requests;
create policy "Requesters can cancel pending memory prompt requests"
  on public.memory_prompt_requests for update
  using (auth.uid() = requester_user_id and status = 'pending')
  with check (auth.uid() = requester_user_id and status in ('pending', 'cancelled'));

drop policy if exists "Recipients can complete pending memory prompt requests" on public.memory_prompt_requests;
create policy "Recipients can complete pending memory prompt requests"
  on public.memory_prompt_requests for update
  using (auth.uid() = recipient_user_id and status = 'pending')
  with check (auth.uid() = recipient_user_id and status in ('pending', 'completed'));

alter table public.wall_posts
  drop constraint if exists wall_posts_memory_prompt_request_fk;
alter table public.wall_posts
  add constraint wall_posts_memory_prompt_request_fk
  foreign key (memory_prompt_request_id) references public.memory_prompt_requests(id) on delete set null;

create index if not exists idx_memory_prompt_requests_requester on public.memory_prompt_requests(requester_user_id, status, created_at desc);
create index if not exists idx_memory_prompt_requests_recipient on public.memory_prompt_requests(recipient_user_id, status, created_at desc);
create index if not exists idx_memory_prompt_requests_wall_post on public.memory_prompt_requests(completed_wall_post_id);
create index if not exists idx_memory_prompt_requests_reference on public.memory_prompt_requests(referenced_wall_post_id);
create index if not exists idx_wall_posts_memory_prompt_request on public.wall_posts(memory_prompt_request_id);
create index if not exists idx_wall_posts_referenced_wall_post on public.wall_posts(referenced_wall_post_id);

do $$
begin
  alter publication supabase_realtime add table public.memory_prompt_requests;
exception
  when duplicate_object then null;
end $$;
