alter table public.wall_posts
  add column if not exists movie_tmdb_id text,
  add column if not exists movie_title text,
  add column if not exists movie_year text,
  add column if not exists movie_poster_url text,
  add column if not exists movie_overview text,
  add column if not exists movie_release_date date,
  add column if not exists movie_vote_average numeric,
  add column if not exists movie_review_rating numeric,
  add column if not exists movie_review_request_id uuid;

alter table public.wall_posts drop constraint if exists wall_posts_post_type_check;
alter table public.wall_posts
  add constraint wall_posts_post_type_check check (post_type in ('note', 'polaroid', 'media', 'song', 'movie', 'voice'));

alter table public.wall_posts drop constraint if exists wall_posts_movie_review_rating_check;
alter table public.wall_posts
  add constraint wall_posts_movie_review_rating_check check (
    movie_review_rating is null
    or (movie_review_rating between 0.5 and 5 and movie_review_rating * 2 = floor(movie_review_rating * 2))
  );

create table if not exists public.movie_review_requests (
  id uuid primary key default uuid_generate_v4(),
  requester_user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  movie_tmdb_id text not null,
  movie_title text not null,
  movie_year text,
  movie_poster_url text,
  movie_overview text,
  movie_release_date date,
  movie_vote_average numeric,
  prompt text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  review_rating numeric check (review_rating between 0.5 and 5 and review_rating * 2 = floor(review_rating * 2)),
  review_body text,
  completed_wall_post_id uuid references public.wall_posts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint movie_review_requests_no_self check (requester_user_id <> recipient_user_id)
);

alter table public.movie_review_requests enable row level security;

drop policy if exists "Users can read involved movie review requests" on public.movie_review_requests;
create policy "Users can read involved movie review requests"
  on public.movie_review_requests for select
  using (auth.uid() = requester_user_id or auth.uid() = recipient_user_id);

drop policy if exists "Friends can create movie review requests" on public.movie_review_requests;
create policy "Friends can create movie review requests"
  on public.movie_review_requests for insert
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

drop policy if exists "Requesters can cancel pending movie review requests" on public.movie_review_requests;
create policy "Requesters can cancel pending movie review requests"
  on public.movie_review_requests for update
  using (auth.uid() = requester_user_id and status = 'pending')
  with check (auth.uid() = requester_user_id and status in ('pending', 'cancelled'));

drop policy if exists "Recipients can complete pending movie review requests" on public.movie_review_requests;
create policy "Recipients can complete pending movie review requests"
  on public.movie_review_requests for update
  using (auth.uid() = recipient_user_id and status = 'pending')
  with check (auth.uid() = recipient_user_id and status in ('pending', 'completed'));

alter table public.wall_posts
  drop constraint if exists wall_posts_movie_review_request_fk;
alter table public.wall_posts
  add constraint wall_posts_movie_review_request_fk
  foreign key (movie_review_request_id) references public.movie_review_requests(id) on delete set null;

create index if not exists idx_movie_review_requests_requester on public.movie_review_requests(requester_user_id, status, created_at desc);
create index if not exists idx_movie_review_requests_recipient on public.movie_review_requests(recipient_user_id, status, created_at desc);
create index if not exists idx_movie_review_requests_wall_post on public.movie_review_requests(completed_wall_post_id);

alter table public.wall_posts
  alter column movie_review_rating type numeric using movie_review_rating::numeric;

alter table public.movie_review_requests
  alter column review_rating type numeric using review_rating::numeric;
