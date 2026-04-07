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
  profile_facts text[] not null default '{}', -- Store profile facts as a text array.
  created_at timestamptz not null default now() -- Store when the profile row was created.
); -- End the profiles table definition.

alter table public.profiles enable row level security; -- Turn on row-level security for profiles.

create policy "Users can read any profile" -- Name the policy that allows profile reads.
  on public.profiles for select using (true); -- Allow all authenticated users to select any profile.

create policy "Users can insert own profile" -- Name the policy that controls profile inserts.
  on public.profiles for insert with check (auth.uid() = id); -- Only allow a user to insert the profile row matching their auth ID.

create policy "Users can update own profile" -- Name the policy that controls profile updates.
  on public.profiles for update using (auth.uid() = id); -- Only allow a user to update their own profile row.

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
  profile_bg text, -- Optionally store a profile background theme key.
  created_at timestamptz not null default now(), -- Store when the contact row was created.
  constraint contacts_unique_link unique (owner_user_id, linked_user_id) -- Prevent duplicate linked contacts per owner.
); -- End the contacts table definition.

alter table public.contacts enable row level security; -- Turn on row-level security for contacts.

create policy "Users can manage own contacts" -- Name the policy that controls all contact operations.
  on public.contacts for all using (auth.uid() = owner_user_id); -- Only allow the owner to read, update, or delete their contacts.

create policy "Linked users can read their contact" -- Let users see the contact card someone else created about them.
  on public.contacts for select using (auth.uid() = linked_user_id);

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

-- Enable realtime on wall_posts and contacts so clients receive live updates.
alter publication supabase_realtime add table public.wall_posts;
alter publication supabase_realtime add table public.contacts;
alter publication supabase_realtime add table public.notifications;
