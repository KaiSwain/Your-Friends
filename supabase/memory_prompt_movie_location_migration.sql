-- Adds "movie" and "location" memory-prompt answer formats.
-- Extends the prompt_type CHECK constraints on the three tables that store a
-- prompt category: memory_prompt_requests (the request), saved_memory_prompts
-- (reusable prompt templates), and wall_posts (the resulting memory).
-- Safe to run multiple times.

ALTER TABLE public.memory_prompt_requests DROP CONSTRAINT IF EXISTS memory_prompt_requests_prompt_type_check;
ALTER TABLE public.memory_prompt_requests ADD CONSTRAINT memory_prompt_requests_prompt_type_check
  CHECK (prompt_type in ('song', 'text', 'photo', 'photo_reference', 'voice', 'movie', 'location'));

ALTER TABLE public.saved_memory_prompts DROP CONSTRAINT IF EXISTS saved_memory_prompts_prompt_type_check;
ALTER TABLE public.saved_memory_prompts ADD CONSTRAINT saved_memory_prompts_prompt_type_check
  CHECK (prompt_type in ('song', 'text', 'photo', 'photo_reference', 'voice', 'movie', 'location'));

ALTER TABLE public.wall_posts DROP CONSTRAINT IF EXISTS wall_posts_prompt_type_check;
ALTER TABLE public.wall_posts ADD CONSTRAINT wall_posts_prompt_type_check
  CHECK (prompt_type is null or prompt_type in ('song', 'text', 'photo', 'photo_reference', 'voice', 'movie', 'location'));
