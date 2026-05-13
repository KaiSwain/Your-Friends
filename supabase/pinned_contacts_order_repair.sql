-- Apply in Supabase SQL Editor before shipping the pin-order app change.
-- Existing pinned contacts get a stable old timestamp so future pins append after them.

alter table public.contacts add column if not exists pinned boolean not null default false;
alter table public.contacts add column if not exists pinned_at timestamptz;

update public.contacts
set pinned_at = created_at
where pinned = true
  and pinned_at is null;

select id, owner_user_id, display_name, pinned, pinned_at
from public.contacts
where pinned = true
order by owner_user_id, pinned_at asc nulls last, created_at desc;