-- Add personality trait chips for profiles and private contact cards.
alter table public.profiles
  add column if not exists profile_personality_traits text[] not null default '{}';

alter table public.contacts
  add column if not exists personality_traits text[] not null default '{}';
