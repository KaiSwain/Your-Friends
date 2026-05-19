-- Restore contact links that were incorrectly cleared from contacts.linked_user_id.
-- Safe to run multiple times: only links unambiguous first-name matches.

with friend_contacts as (
  select
    c.id as contact_id,
    c.owner_user_id,
    c.display_name as contact_name,
    case
      when f.user_low_id = c.owner_user_id then f.user_high_id
      else f.user_low_id
    end as friend_user_id
  from public.contacts c
  join public.friendships f
    on c.owner_user_id in (f.user_low_id, f.user_high_id)
  where c.linked_user_id is null
),
candidate_matches as (
  select
    fc.contact_id,
    fc.friend_user_id,
    count(*) over (partition by fc.owner_user_id, fc.friend_user_id) as match_count
  from friend_contacts fc
  join public.profiles p on p.id = fc.friend_user_id
  where lower(regexp_replace(split_part(trim(fc.contact_name), ' ', 1), '[^a-z0-9'']', '', 'g'))
    = lower(regexp_replace(split_part(trim(p.display_name), ' ', 1), '[^a-z0-9'']', '', 'g'))
    and not exists (
      select 1
      from public.contacts already
      where already.owner_user_id = fc.owner_user_id
        and already.linked_user_id = fc.friend_user_id
    )
)
update public.contacts c
set linked_user_id = cm.friend_user_id
from candidate_matches cm
where c.id = cm.contact_id
  and cm.match_count = 1;
