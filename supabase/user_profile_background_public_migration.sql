-- Add an explicit privacy toggle for whether a user's Settings background appears on their public profile.
alter table public.profiles
  add column if not exists profile_bg_image_public boolean not null default false;
