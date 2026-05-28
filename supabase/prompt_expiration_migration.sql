-- Add one-week expiration timers to memory and movie prompts.

alter table public.memory_prompt_requests
  add column if not exists expires_at timestamptz;

update public.memory_prompt_requests
set expires_at = created_at + interval '7 days'
where expires_at is null;

alter table public.memory_prompt_requests
  alter column expires_at set default (now() + interval '7 days'),
  alter column expires_at set not null;

create index if not exists idx_memory_prompt_requests_expires
  on public.memory_prompt_requests(recipient_user_id, status, expires_at);

alter table public.movie_review_requests
  add column if not exists expires_at timestamptz;

update public.movie_review_requests
set expires_at = created_at + interval '7 days'
where expires_at is null;

alter table public.movie_review_requests
  alter column expires_at set default (now() + interval '7 days'),
  alter column expires_at set not null;

create index if not exists idx_movie_review_requests_expires
  on public.movie_review_requests(recipient_user_id, status, expires_at);
