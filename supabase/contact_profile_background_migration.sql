-- Add Premium gallery-photo backgrounds for contact profile pages.
alter table public.contacts
  add column if not exists profile_bg_image_path text;
