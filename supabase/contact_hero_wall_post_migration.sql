alter table public.contacts
  add column if not exists hero_wall_post_id uuid references public.wall_posts(id) on delete set null;

create index if not exists idx_contacts_hero_wall_post
  on public.contacts(hero_wall_post_id);
