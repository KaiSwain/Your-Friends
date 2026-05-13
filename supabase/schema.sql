-- Name this file as the full Supabase schema for the YourFriends app.
-- Tell the reader this script should be run inside the Supabase SQL editor.

-- Enable the UUID extension so default UUID values can be generated in SQL.
create extension if not exists "uuid-ossp"; -- Install the uuid-ossp extension if it is not already enabled.

-- Mark the start of the profiles table section.
-- Explain that profiles are app-level user records linked to auth.users.
create table public.profiles ( -- Create the profiles table in the public schema.
  id uuid primary key references auth.users(id) on delete cascade, -- Use the auth user ID as the profile primary key.
  email text not null, -- Store the user's email address.
  display_name text not null, -- Store the display name shown in the UI.
  friend_code text unique not null, -- Store the unique friend code used to connect users.
  avatar_color text not null default '#7C5CFC', -- Store a fallback avatar color for the profile.
  avatar_path text, -- Optionally store a path to an uploaded avatar image.
  push_token text, -- Store the Expo push notification token for server-side sends.
  profile_facts text[] not null default '{}', -- Store profile facts as a text array.
  premium_until timestamptz, -- Store when Premium access expires, including referral rewards.
  created_at timestamptz not null default now() -- Store when the profile row was created.
); -- End the profiles table definition.

alter table public.profiles enable row level security; -- Turn on row-level security for profiles.

create policy "Users can read any profile" -- Name the policy that allows profile reads.
  on public.profiles for select using (true); -- Allow all authenticated users to select any profile.

create policy "Users can insert own profile" -- Name the policy that controls profile inserts.
  on public.profiles for insert with check (auth.uid() = id); -- Only allow a user to insert the profile row matching their auth ID.

create policy "Users can update own profile" -- Name the policy that controls profile updates.
  on public.profiles for update using (auth.uid() = id); -- Only allow a user to update their own profile row.

-- Referral rewards — one row per referred account.
create table public.referrals (
  id uuid primary key default uuid_generate_v4(),
  referrer_user_id uuid not null references public.profiles(id) on delete cascade,
  referee_user_id uuid not null references public.profiles(id) on delete cascade,
  referrer_code_at_signup text not null,
  reward_days integer not null default 7 check (reward_days > 0),
  reward_granted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint referrals_no_self check (referrer_user_id <> referee_user_id),
  constraint referrals_unique_referee unique (referee_user_id)
);

alter table public.referrals enable row level security;

create policy "Users can read own referrals"
  on public.referrals for select
  using (auth.uid() = referrer_user_id or auth.uid() = referee_user_id);

create index idx_referrals_referrer on public.referrals(referrer_user_id);
create index idx_referrals_referee on public.referrals(referee_user_id);

create or replace function public.apply_referral_reward(referee_id uuid, referral_code text)
returns table (
  referrer_user_id uuid,
  referee_premium_until timestamptz,
  referrer_premium_until timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text := upper(regexp_replace(coalesce(referral_code, ''), '[^a-zA-Z0-9]', '', 'g'));
  reward_days integer := 7;
  matched_referrer_id uuid;
  existing_referral public.referrals%rowtype;
begin
  if auth.uid() is null or auth.uid() <> referee_id then
    raise exception 'Referral reward can only be applied by the referred user.';
  end if;

  if normalized_code = '' then
    raise exception 'Referral code is required.';
  end if;

  select p.id into matched_referrer_id
  from public.profiles p
  where p.friend_code = normalized_code;

  if matched_referrer_id is null then
    raise exception 'Referral code not found.';
  end if;

  if matched_referrer_id = referee_id then
    raise exception 'Self-referrals are not allowed.';
  end if;

  select * into existing_referral
  from public.referrals r
  where r.referee_user_id = referee_id;

  if existing_referral.id is not null then
    if existing_referral.referrer_user_id <> matched_referrer_id then
      raise exception 'This account already has a referral.';
    end if;

    select p.premium_until into referee_premium_until
    from public.profiles p
    where p.id = referee_id;

    select p.premium_until into referrer_premium_until
    from public.profiles p
    where p.id = matched_referrer_id;

    referrer_user_id := matched_referrer_id;
    return next;
    return;
  end if;

  insert into public.referrals (
    referrer_user_id,
    referee_user_id,
    referrer_code_at_signup,
    reward_days,
    reward_granted_at
  ) values (
    matched_referrer_id,
    referee_id,
    normalized_code,
    reward_days,
    now()
  );

  update public.profiles
  set premium_until = greatest(coalesce(premium_until, now()), now()) + make_interval(days => reward_days)
  where id = referee_id
  returning premium_until into referee_premium_until;

  update public.profiles
  set premium_until = greatest(coalesce(premium_until, now()), now()) + make_interval(days => reward_days)
  where id = matched_referrer_id
  returning premium_until into referrer_premium_until;

  referrer_user_id := matched_referrer_id;
  return next;
end;
$$;

grant execute on function public.apply_referral_reward(uuid, text) to authenticated;

-- Mark the start of the private contacts section.
-- Explain that contacts are private records owned by a single user.
create table public.contacts ( -- Create the contacts table in the public schema.
  id uuid primary key default uuid_generate_v4(), -- Give each contact a generated UUID primary key.
  owner_user_id uuid not null references public.profiles(id) on delete cascade, -- Store which profile owns the contact.
  linked_user_id uuid references public.profiles(id) on delete set null, -- Optionally link the contact to a real user profile.
  display_name text not null, -- Store the contact's display name.
  nickname text, -- Optionally store a private nickname for the contact.
  facts text[] not null default '{}', -- Store contact facts as a text array.
  avatar_path text, -- Optionally store a path to an uploaded avatar image.
  tags text[] not null default '{}', -- Store relationship tags as a text array.
  note text, -- Optionally store a short note about this contact.
  card_color text, -- Optionally store a card background color.
  back_text text, -- Optionally store text written on the back of the profile card.
  profile_bg text, -- Optionally store a profile background theme key.
  created_at timestamptz not null default now(), -- Store when the contact row was created.
  constraint contacts_unique_link unique (owner_user_id, linked_user_id) -- Prevent duplicate linked contacts per owner.
); -- End the contacts table definition.

alter table public.contacts enable row level security; -- Turn on row-level security for contacts.

create policy "Users can manage own contacts" -- Name the policy that controls all contact operations.
  on public.contacts for all using (auth.uid() = owner_user_id); -- Only allow the owner to read, update, or delete their contacts.

create policy "Linked users can read their contact" -- Let users see the contact card someone else created about them.
  on public.contacts for select using (auth.uid() = linked_user_id);

alter table public.contacts add column if not exists pinned boolean not null default false;
alter table public.contacts add column if not exists pinned_at timestamptz;
update public.contacts set pinned_at = created_at where pinned = true and pinned_at is null;

-- Private contact notes — iOS Notes-style private notes owned by one user.
create table public.contact_private_notes (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  title text not null default 'Untitled note',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contact_private_notes enable row level security;

create policy "Users can manage own private notes"
  on public.contact_private_notes for all
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

create table public.contact_private_note_blocks (
  id uuid primary key default uuid_generate_v4(),
  note_id uuid not null references public.contact_private_notes(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('text', 'link', 'image')),
  content text,
  url text,
  image_path text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contact_private_note_blocks enable row level security;

create policy "Users can manage own private note blocks"
  on public.contact_private_note_blocks for all
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

create index idx_private_notes_owner_contact on public.contact_private_notes(owner_user_id, contact_id);
create index idx_private_notes_updated on public.contact_private_notes(updated_at desc);
create index idx_private_note_blocks_note_order on public.contact_private_note_blocks(note_id, sort_order);

-- Private note media bucket. Object paths start with the owner's user id:
-- <owner_user_id>/<note_id>/<filename>.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'private_notes',
  'private_notes',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set public = false;

drop policy if exists "Users can read own private note media" on storage.objects;
drop policy if exists "Users can upload own private note media" on storage.objects;
drop policy if exists "Users can update own private note media" on storage.objects;
drop policy if exists "Users can delete own private note media" on storage.objects;

create policy "Users can read own private note media"
  on storage.objects for select to authenticated
  using (bucket_id = 'private_notes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can upload own private note media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'private_notes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update own private note media"
  on storage.objects for update to authenticated
  using (bucket_id = 'private_notes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'private_notes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete own private note media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'private_notes' and (storage.foldername(name))[1] = auth.uid()::text);

-- Mark the start of the friendships section.
-- Explain that friendships are stored in canonical user-ID order.
create table public.friendships ( -- Create the friendships table in the public schema.
  id uuid primary key default uuid_generate_v4(), -- Give each friendship a generated UUID primary key.
  user_low_id uuid not null references public.profiles(id) on delete cascade, -- Store the lexicographically lower user ID.
  user_high_id uuid not null references public.profiles(id) on delete cascade, -- Store the lexicographically higher user ID.
  created_by_user_id uuid not null references public.profiles(id), -- Store which user created the friendship.
  created_at timestamptz not null default now(), -- Store when the friendship row was created.
  constraint friendships_ordering check (user_low_id < user_high_id), -- Enforce canonical ordering so each friendship only has one valid shape.
  constraint friendships_unique unique (user_low_id, user_high_id) -- Prevent duplicate friendship rows.
); -- End the friendships table definition.

alter table public.friendships enable row level security; -- Turn on row-level security for friendships.

create policy "Users can read own friendships" -- Name the policy that controls friendship reads.
  on public.friendships for select -- Apply the policy to SELECT queries.
  using (auth.uid() = user_low_id or auth.uid() = user_high_id); -- Only allow either participant to read a friendship.

create policy "Users can create friendships involving themselves" -- Name the policy that controls friendship inserts.
  on public.friendships for insert -- Apply the policy to INSERT queries.
  with check (auth.uid() = created_by_user_id); -- Only allow users to create friendships on their own behalf.

-- Mark the start of the wall posts section.
-- Explain that wall posts are memories written about either a user or a contact.
create table public.wall_posts ( -- Create the wall_posts table in the public schema.
  id uuid primary key default uuid_generate_v4(), -- Give each wall post a generated UUID primary key.
  author_user_id uuid not null references public.profiles(id) on delete cascade, -- Store which user wrote the memory.
  subject_user_id uuid references public.profiles(id) on delete cascade, -- Optionally store the subject as a real user.
  subject_contact_id uuid references public.contacts(id) on delete cascade, -- Optionally store the subject as a private contact.
  visibility text not null default 'private' check (visibility in ('private', 'visible_to_subject')), -- Restrict visibility to the supported values.
  body text not null, -- Store the main memory text.
  image_path text, -- Optionally store an uploaded image path or URL.
  card_color text, -- Optionally store a custom card color for the polaroid frame.
  back_text text, -- Optionally store text written on the back of the polaroid.
  filter text, -- Optionally store a photo filter key (e.g. vintage, warm, cool).
  date_stamp boolean not null default false, -- Optionally store whether to show a date stamp overlay on the photo.
  created_at timestamptz not null default now(), -- Store when the wall post row was created.
  constraint wall_posts_has_subject check ( -- Enforce that exactly one kind of subject is set.
    (subject_user_id is not null and subject_contact_id is null) or -- Allow a real-user subject with no contact subject.
    (subject_user_id is null and subject_contact_id is not null) -- Allow a contact subject with no real-user subject.
  ) -- End the subject exclusivity check.
); -- End the wall_posts table definition.

alter table public.wall_posts enable row level security; -- Turn on row-level security for wall posts.

create policy "Authors can manage own wall posts" -- Name the policy that gives authors full control of their own posts.
  on public.wall_posts for all using (auth.uid() = author_user_id); -- Only allow the author to manage their own posts.

create policy "Subjects can read visible posts about them" -- Name the policy that lets subjects read visible posts.
  on public.wall_posts for select -- Apply the policy to SELECT queries.
  using ( -- Start the visibility rule.
    auth.uid() = subject_user_id -- Allow reads when the current user is the subject user.
    and visibility = 'visible_to_subject' -- Require the post visibility to permit subject access.
  ); -- End the subject-read policy.

create policy "Subjects can read posts about linked contacts" -- Let users see posts about contacts linked to them.
  on public.wall_posts for select
  using (
    visibility = 'visible_to_subject'
    and subject_contact_id is not null
    and exists (
      select 1 from public.contacts c
      where c.id = wall_posts.subject_contact_id
        and c.linked_user_id = auth.uid()
    )
  );

-- Calendar events — Premium-created dates owned by one user.
create table public.calendar_events (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  subject_user_id uuid references public.profiles(id) on delete cascade,
  subject_contact_id uuid references public.contacts(id) on delete cascade,
  event_type text not null check (event_type in ('birthday', 'anniversary', 'custom')),
  title text not null,
  event_date date not null,
  event_time time,
  all_day boolean not null default true,
  recurrence text not null default 'none' check (recurrence in ('none', 'yearly', 'monthly')),
  reminder_offsets integer[] not null default '{}',
  completed_occurrence_keys text[] not null default '{}',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_events_subject_exclusive check (
    subject_user_id is null or subject_contact_id is null
  ),
  constraint calendar_events_reminders_supported check (
    reminder_offsets <@ array[0, 1, 7]
  )
);

alter table public.calendar_events enable row level security;

create policy "Users can manage own calendar events"
  on public.calendar_events for all
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

-- Mark the storage section for memory images.
-- Tell the reader to create the bucket manually in the dashboard.

-- Mark the start of the indexes section.
-- Explain that these indexes speed up the most common lookup queries.
create index idx_contacts_owner on public.contacts(owner_user_id); -- Speed up queries by contact owner.
create index idx_friendships_low on public.friendships(user_low_id); -- Speed up friendship lookups by low user ID.
create index idx_friendships_high on public.friendships(user_high_id); -- Speed up friendship lookups by high user ID.
create index idx_wall_posts_subject_user on public.wall_posts(subject_user_id); -- Speed up wall-post lookups by subject user.
create index idx_wall_posts_subject_contact on public.wall_posts(subject_contact_id); -- Speed up wall-post lookups by subject contact.
create index idx_wall_posts_author on public.wall_posts(author_user_id); -- Speed up wall-post lookups by author.
create index idx_profiles_friend_code on public.profiles(friend_code); -- Speed up friend-code lookup queries.
create index idx_calendar_events_owner_date on public.calendar_events(owner_user_id, event_date);
create index idx_calendar_events_subject_user on public.calendar_events(subject_user_id);
create index idx_calendar_events_subject_contact on public.calendar_events(subject_contact_id);

-- Mark the start of the friend_facts section.
-- Explain that friend_facts stores per-viewer notes about a friend (not the friend's own profile facts).
create table public.friend_facts (
  id uuid primary key default uuid_generate_v4(),
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  subject_user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint friend_facts_no_self check (author_user_id <> subject_user_id)
);

alter table public.friend_facts enable row level security;

create policy "Authors can manage own friend facts"
  on public.friend_facts for all using (auth.uid() = author_user_id);

create policy "Subjects can read facts about them"
  on public.friend_facts for select using (auth.uid() = subject_user_id);

create index idx_friend_facts_author on public.friend_facts(author_user_id);
create index idx_friend_facts_subject on public.friend_facts(subject_user_id);

-- Notifications table — stores events the recipient should see.
create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  actor_user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null, -- 'wall_post' | 'friend_request' | 'contact_update'
  reference_id text, -- ID of the related wall_post, friendship, etc.
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "Users can read own notifications"
  on public.notifications for select using (auth.uid() = recipient_user_id);

create policy "Users can update own notifications"
  on public.notifications for update using (auth.uid() = recipient_user_id);

create policy "Authenticated users can insert notifications"
  on public.notifications for insert with check (true);

create index idx_notifications_recipient on public.notifications(recipient_user_id);

-- Migrations: add columns that were added after initial table creation.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS premium_until timestamptz;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS date_stamp boolean not null default false;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS filter text;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS back_text text;

-- Enable realtime on wall_posts and contacts so clients receive live updates.
alter publication supabase_realtime add table public.wall_posts;
alter publication supabase_realtime add table public.contacts;
alter publication supabase_realtime add table public.contact_private_notes;
alter publication supabase_realtime add table public.contact_private_note_blocks;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.calendar_events;
