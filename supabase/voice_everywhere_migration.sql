-- Add voice attachments to text-heavy social flows.

alter table public.memory_replies
  add column if not exists audio_path text;

alter table public.memory_replies
  add column if not exists audio_duration_ms integer;

alter table public.memory_prompt_requests
  add column if not exists prompt_audio_path text;

alter table public.memory_prompt_requests
  add column if not exists prompt_audio_duration_ms integer;

alter table public.wall_posts
  add column if not exists prompt_audio_path text;

alter table public.wall_posts
  add column if not exists prompt_audio_duration_ms integer;

update public.wall_posts wp
set
  prompt_audio_path = mpr.prompt_audio_path,
  prompt_audio_duration_ms = mpr.prompt_audio_duration_ms
from public.memory_prompt_requests mpr
where wp.memory_prompt_request_id = mpr.id
  and wp.prompt_audio_path is null
  and mpr.prompt_audio_path is not null;

alter table public.movie_review_requests
  add column if not exists prompt_audio_path text;

alter table public.movie_review_requests
  add column if not exists prompt_audio_duration_ms integer;

alter table public.movie_review_requests
  add column if not exists review_audio_path text;

alter table public.movie_review_requests
  add column if not exists review_audio_duration_ms integer;

update public.wall_posts wp
set
  prompt_audio_path = mrr.prompt_audio_path,
  prompt_audio_duration_ms = mrr.prompt_audio_duration_ms,
  prompt_text = coalesce(wp.prompt_text, mrr.prompt, case when mrr.prompt_audio_path is not null then 'Voice prompt' else null end),
  prompt_type = coalesce(wp.prompt_type, case when mrr.prompt is not null or mrr.prompt_audio_path is not null then 'text' else null end)
from public.movie_review_requests mrr
where wp.movie_review_request_id = mrr.id
  and wp.prompt_audio_path is null
  and mrr.prompt_audio_path is not null;
