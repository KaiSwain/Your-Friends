-- Allow half-star movie ratings (for example 2.5) in existing databases.
-- Older installs may still have these columns as smallint, which rejects decimals.

alter table public.wall_posts
  add column if not exists movie_review_rating numeric;

alter table public.wall_posts
  drop constraint if exists wall_posts_movie_review_rating_check;

alter table public.wall_posts
  alter column movie_review_rating type numeric using movie_review_rating::numeric;

alter table public.wall_posts
  add constraint wall_posts_movie_review_rating_check check (
    movie_review_rating is null
    or (movie_review_rating between 0.5 and 5 and movie_review_rating * 2 = floor(movie_review_rating * 2))
  );

alter table public.movie_review_requests
  add column if not exists review_rating numeric;

alter table public.movie_review_requests
  drop constraint if exists movie_review_requests_review_rating_check;

alter table public.movie_review_requests
  alter column review_rating type numeric using review_rating::numeric;

alter table public.movie_review_requests
  add constraint movie_review_requests_review_rating_check check (
    review_rating is null
    or (review_rating between 0.5 and 5 and review_rating * 2 = floor(review_rating * 2))
  );
