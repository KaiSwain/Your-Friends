-- Add Photo Prompts, where friends answer with a new Memory Card or media memory.
alter table public.wall_posts drop constraint if exists wall_posts_prompt_type_check;
alter table public.wall_posts add constraint wall_posts_prompt_type_check
  check (prompt_type is null or prompt_type in ('song', 'text', 'photo', 'photo_reference', 'voice'));

alter table public.memory_prompt_requests drop constraint if exists memory_prompt_requests_prompt_type_check;
alter table public.memory_prompt_requests add constraint memory_prompt_requests_prompt_type_check
  check (prompt_type in ('song', 'text', 'photo', 'photo_reference', 'voice'));
