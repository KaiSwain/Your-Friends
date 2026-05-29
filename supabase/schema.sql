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
  birthday date, -- Optionally store the user's birthday for friend calendar sync.
  profile_bg_image_path text, -- Optionally store an uploaded Premium profile background image URL.
  profile_bg_image_public boolean not null default false, -- Let users explicitly choose whether their background appears on their public profile.
  push_token text, -- Store the Expo push notification token for server-side sends.
  profile_facts text[] not null default '{}', -- Store profile facts as a text array.
  profile_personality_traits text[] not null default '{}', -- Store profile personality trait chips as a text array.
  premium_until timestamptz, -- Store the active Premium expiry for compatibility with existing checks.
  premium_paid_until timestamptz, -- Store paid subscription Premium expiry separately from free grants.
  premium_free_until timestamptz, -- Store QR-granted free Premium expiry separately from paid access.
  premium_free_granted_by_user_id uuid references public.profiles(id) on delete set null, -- Track who granted the current free Premium window.
  premium_free_granted_at timestamptz, -- Track when the current free Premium window was granted.
  is_official boolean not null default false, -- Mark the official Your Friends team account.
  is_team_admin boolean not null default false, -- Allow this profile to access team-only admin tools.
  created_at timestamptz not null default now() -- Store when the profile row was created.
); -- End the profiles table definition.

alter table public.profiles enable row level security; -- Turn on row-level security for profiles.

alter table public.profiles add column if not exists profile_bg_image_path text;
alter table public.profiles add column if not exists profile_bg_image_public boolean not null default false;
alter table public.profiles add column if not exists profile_personality_traits text[] not null default '{}';
alter table public.profiles add column if not exists birthday date;
alter table public.profiles add column if not exists premium_paid_until timestamptz;
alter table public.profiles add column if not exists premium_free_until timestamptz;
alter table public.profiles add column if not exists premium_free_granted_by_user_id uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists premium_free_granted_at timestamptz;
alter table public.profiles add column if not exists is_official boolean not null default false;
alter table public.profiles add column if not exists is_team_admin boolean not null default false;

create unique index if not exists profiles_single_official_account
  on public.profiles (is_official)
  where is_official = true;

create or replace function public.prevent_profile_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and not (new.is_official or new.is_team_admin) then
    return new;
  end if;

  if tg_op = 'UPDATE' and not (
    old.is_official is distinct from new.is_official
    or old.is_team_admin is distinct from new.is_team_admin
  ) then
    return new;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    if auth.uid() is not null and not exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_team_admin = true
    ) then
      raise exception 'Only team admins can update official account flags.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_self_escalation on public.profiles;
create trigger profiles_prevent_role_self_escalation
  before insert or update of is_official, is_team_admin on public.profiles
  for each row
  execute function public.prevent_profile_role_self_escalation();

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

-- Premium QR grants — scanning any active Premium user's QR grants a free Premium trial.
create table if not exists public.premium_qr_grants (
  id uuid primary key default uuid_generate_v4(),
  grantor_user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  reward_days integer not null default 3 check (reward_days > 0),
  recipient_premium_until timestamptz not null,
  created_at timestamptz not null default now(),
  constraint premium_qr_grants_no_self check (grantor_user_id <> recipient_user_id),
  constraint premium_qr_grants_unique_pair unique (grantor_user_id, recipient_user_id)
);

alter table public.premium_qr_grants enable row level security;

create policy "Users can read own premium QR grants"
  on public.premium_qr_grants for select
  using (auth.uid() = grantor_user_id or auth.uid() = recipient_user_id);

create index if not exists idx_premium_qr_grants_grantor on public.premium_qr_grants(grantor_user_id);
create index if not exists idx_premium_qr_grants_recipient on public.premium_qr_grants(recipient_user_id);
create index if not exists idx_premium_qr_grants_grantor_active on public.premium_qr_grants(grantor_user_id, recipient_premium_until);

create or replace function public.apply_premium_qr_grant(recipient_id uuid, grantor_code text)
returns table (
  grantor_user_id uuid,
  recipient_premium_until timestamptz,
  recipient_free_until timestamptz,
  granted boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text := upper(regexp_replace(coalesce(grantor_code, ''), '[^a-zA-Z0-9]', '', 'g'));
  reward_days integer := 3;
  matched_grantor_id uuid;
  grantor_premium_until timestamptz;
  existing_grant public.premium_qr_grants%rowtype;
  current_recipient_premium_until timestamptz;
  current_recipient_paid_until timestamptz;
  current_recipient_free_until timestamptz;
  active_grant_count integer;
begin
  if auth.uid() is null or auth.uid() <> recipient_id then
    raise exception 'Premium QR grants can only be applied by the scanning user.';
  end if;

  if normalized_code = '' then
    raise exception 'QR code is required.';
  end if;

  select
    p.id,
    greatest(
      coalesce(p.premium_until, '-infinity'::timestamptz),
      coalesce(p.premium_paid_until, '-infinity'::timestamptz),
      coalesce(p.premium_free_until, '-infinity'::timestamptz)
    )
  into matched_grantor_id, grantor_premium_until
  from public.profiles p
  where p.friend_code = normalized_code;

  if matched_grantor_id is null then
    raise exception 'Friend QR code not found.';
  end if;

  if matched_grantor_id = recipient_id then
    raise exception 'Self QR grants are not allowed.';
  end if;

  if grantor_premium_until is null or grantor_premium_until <= now() then
    raise exception 'This QR code belongs to someone without active Premium.';
  end if;

  if not exists (
    select 1
    from public.friendships f
    where f.user_low_id = least(matched_grantor_id, recipient_id)
      and f.user_high_id = greatest(matched_grantor_id, recipient_id)
  ) then
    raise exception 'You need to be friends before this Premium QR can unlock free Premium.';
  end if;

  select * into existing_grant
  from public.premium_qr_grants qr_grant
  where qr_grant.grantor_user_id = matched_grantor_id
    and qr_grant.recipient_user_id = recipient_id;

  if existing_grant.id is not null then
    select
      greatest(
        coalesce(p.premium_until, '-infinity'::timestamptz),
        coalesce(p.premium_paid_until, '-infinity'::timestamptz),
        coalesce(p.premium_free_until, '-infinity'::timestamptz)
      ),
      p.premium_free_until
    into recipient_premium_until, recipient_free_until
    from public.profiles p
    where p.id = recipient_id;

    grantor_user_id := matched_grantor_id;
    granted := false;
    return next;
    return;
  end if;

  select count(*) into active_grant_count
  from public.premium_qr_grants qr_grant
  where qr_grant.grantor_user_id = matched_grantor_id
    and qr_grant.recipient_premium_until > now();

  if active_grant_count >= 3 then
    raise exception 'This Premium friend already has 3 active free Premium grants. Try again after one expires.';
  end if;

  select p.premium_until, p.premium_paid_until, p.premium_free_until
  into current_recipient_premium_until, current_recipient_paid_until, current_recipient_free_until
  from public.profiles p
  where p.id = recipient_id;

  recipient_free_until := greatest(coalesce(current_recipient_free_until, now()), now()) + make_interval(days => reward_days);
  recipient_premium_until := greatest(
    coalesce(current_recipient_premium_until, '-infinity'::timestamptz),
    coalesce(current_recipient_paid_until, '-infinity'::timestamptz),
    recipient_free_until
  );

  update public.profiles
  set
    premium_free_until = recipient_free_until,
    premium_until = recipient_premium_until,
    premium_free_granted_by_user_id = matched_grantor_id,
    premium_free_granted_at = now()
  where id = recipient_id;

  insert into public.premium_qr_grants (
    grantor_user_id,
    recipient_user_id,
    reward_days,
    recipient_premium_until
  ) values (
    matched_grantor_id,
    recipient_id,
    reward_days,
    recipient_premium_until
  );

  grantor_user_id := matched_grantor_id;
  granted := true;
  return next;
end;
$$;

grant execute on function public.apply_premium_qr_grant(uuid, text) to authenticated;

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
  personality_traits text[] not null default '{}', -- Store contact personality trait chips as a text array.
  avatar_path text, -- Optionally store a path to an uploaded avatar image.
  avatar_video_path text, -- Optionally store a hero card video URL.
  avatar_video_muted boolean not null default false, -- Optionally force the hero card video to play without audio.
  hero_wall_post_id uuid references public.wall_posts(id) on delete set null, -- Optionally use an existing memory as this local profile card.
  tags text[] not null default '{}', -- Store relationship tags as a text array.
  note text, -- Optionally store a short note about this contact.
  card_color text, -- Optionally store a card background color.
  back_text text, -- Optionally store text written on the back of the profile card.
  profile_bg text, -- Optionally store a profile background theme key.
  profile_bg_image_path text, -- Optionally store an uploaded Premium profile background image URL.
  created_at timestamptz not null default now(), -- Store when the contact row was created.
  constraint contacts_unique_link unique (owner_user_id, linked_user_id) -- Prevent duplicate linked contacts per owner.
); -- End the contacts table definition.

alter table public.contacts enable row level security; -- Turn on row-level security for contacts.

create policy "Users can manage own contacts" -- Name the policy that controls all contact operations.
  on public.contacts for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id); -- Only allow the owner to read, update, or delete their contacts.

create policy "Linked users can read their contact" -- Let users see the contact card someone else created about them.
  on public.contacts for select using (auth.uid() = linked_user_id);

alter table public.contacts add column if not exists pinned boolean not null default false;
alter table public.contacts add column if not exists pinned_at timestamptz;
alter table public.contacts add column if not exists personality_traits text[] not null default '{}';
alter table public.contacts add column if not exists profile_bg_image_path text;
alter table public.contacts add column if not exists avatar_video_path text;
alter table public.contacts add column if not exists avatar_video_muted boolean not null default false;
alter table public.contacts add column if not exists hero_wall_post_id uuid references public.wall_posts(id) on delete set null;
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

-- Public memory media bucket. Stores Memory Cards, regular media, voice notes,
-- profile images, and other public wall assets used by the app.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'Memories',
  'Memories',
  true,
  52428800,
  array[
    'image/jpg',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'audio/mp4',
    'audio/mpeg',
    'audio/aac',
    'audio/wav',
    'audio/x-caf'
  ]
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users can read memory media" on storage.objects;
drop policy if exists "Authenticated users can upload memory media" on storage.objects;
drop policy if exists "Authenticated users can update memory media" on storage.objects;
drop policy if exists "Authenticated users can delete memory media" on storage.objects;

create policy "Authenticated users can read memory media"
  on storage.objects for select to authenticated
  using (bucket_id = 'Memories');

create policy "Authenticated users can upload memory media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'Memories');

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

create policy "Users can delete own friendships"
  on public.friendships for delete
  using (auth.uid() = user_low_id or auth.uid() = user_high_id);

-- Friend requests section — stores pending requests before a friendship exists.
create table public.friend_requests (
  id uuid primary key default uuid_generate_v4(),
  requester_user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_requests_not_self check (requester_user_id <> recipient_user_id),
  constraint friend_requests_unique_pair unique (requester_user_id, recipient_user_id)
);

alter table public.friend_requests enable row level security;

create policy "Users can read involved friend requests"
  on public.friend_requests for select
  using (auth.uid() = requester_user_id or auth.uid() = recipient_user_id);

create policy "Users can send friend requests"
  on public.friend_requests for insert
  with check (auth.uid() = requester_user_id and status = 'pending');

create policy "Recipients can respond to friend requests"
  on public.friend_requests for update
  using (auth.uid() = recipient_user_id)
  with check (auth.uid() = recipient_user_id and status in ('accepted', 'declined'));

create policy "Requesters can resend declined friend requests"
  on public.friend_requests for update
  using (auth.uid() = requester_user_id and status = 'declined')
  with check (auth.uid() = requester_user_id and status = 'pending' and responded_at is null);

create index idx_friend_requests_recipient on public.friend_requests(recipient_user_id, status);
create index idx_friend_requests_requester on public.friend_requests(requester_user_id, status);

-- Official Your Friends account connection helpers.
create or replace function public.connect_official_account_pair(user_id uuid, official_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if user_id is null or official_user_id is null or user_id = official_user_id then
    return;
  end if;

  insert into public.friendships (
    user_low_id,
    user_high_id,
    created_by_user_id
  ) values (
    least(user_id, official_user_id),
    greatest(user_id, official_user_id),
    official_user_id
  )
  on conflict (user_low_id, user_high_id) do nothing;

  insert into public.contacts (
    owner_user_id,
    linked_user_id,
    display_name,
    facts,
    avatar_path,
    tags,
    note,
    card_color,
    back_text,
    profile_bg
  )
  select
    user_id,
    p.id,
    p.display_name,
    '{}',
    p.avatar_path,
    '{}',
    'Official updates from the Your Friends team.',
    p.avatar_color,
    'Team updates, product notes, and little surprises from Your Friends.',
    null
  from public.profiles p
  where p.id = official_user_id
  on conflict (owner_user_id, linked_user_id) do nothing;
end;
$$;

create or replace function public.sync_official_account_connections()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  official_user_id uuid;
  profile_row record;
begin
  if new.is_official then
    for profile_row in
      select id from public.profiles where id <> new.id
    loop
      perform public.connect_official_account_pair(profile_row.id, new.id);
    end loop;
    return new;
  end if;

  select id into official_user_id
  from public.profiles
  where is_official = true
  order by created_at asc
  limit 1;

  perform public.connect_official_account_pair(new.id, official_user_id);
  return new;
end;
$$;

drop trigger if exists profiles_sync_official_account_connections on public.profiles;
drop trigger if exists profiles_sync_official_account_connections_on_update on public.profiles;
create trigger profiles_sync_official_account_connections
  after insert on public.profiles
  for each row
  execute function public.sync_official_account_connections();

create trigger profiles_sync_official_account_connections_on_update
  after update of is_official on public.profiles
  for each row
  when (old.is_official is distinct from new.is_official)
  execute function public.sync_official_account_connections();

-- Mark the start of the wall posts section.
-- Explain that wall posts are memories written about either a user or a contact.
create table public.wall_posts ( -- Create the wall_posts table in the public schema.
  id uuid primary key default uuid_generate_v4(), -- Give each wall post a generated UUID primary key.
  author_user_id uuid not null references public.profiles(id) on delete cascade, -- Store which user wrote the memory.
  subject_user_id uuid references public.profiles(id) on delete cascade, -- Optionally store the subject as a real user.
  subject_contact_id uuid references public.contacts(id) on delete cascade, -- Optionally store the subject as a private contact.
  visibility text not null default 'private' check (visibility in ('private', 'visible_to_subject')), -- Restrict visibility to the supported values.
  post_type text not null default 'note' check (post_type in ('note', 'polaroid', 'media', 'song', 'movie', 'voice')), -- Store which wall presentation this memory uses.
  body text not null, -- Store the main memory text.
  image_path text, -- Optionally store an uploaded image path or URL.
  image_thumb_path text, -- Optionally store a lightweight image thumbnail URL for fast wall rendering.
  video_path text, -- Optionally store an uploaded Live Memory Card video URL.
  video_muted boolean not null default false, -- Optionally force the Live Memory Card video to play without audio.
  card_color text, -- Optionally store a custom card color for the memory card frame.
  back_text text, -- Optionally store text written on the back of the memory card.
  filter text, -- Optionally store a photo filter key (e.g. vintage, warm, cool).
  date_stamp boolean not null default false, -- Optionally store whether to show a date stamp overlay on the photo.
  memory_date date, -- Optionally store when the memory happened, separate from when it was posted.
  location_name text, -- Optionally store a user-entered place name for this memory.
  song_provider text check (song_provider in ('apple', 'spotify')), -- Optionally store the source provider for a song memory.
  song_provider_id text, -- Optionally store the provider's track ID.
  song_title text, -- Optionally store the song title shown on the wall.
  song_artist text, -- Optionally store the song artist shown on the wall.
  song_artwork_url text, -- Optionally store album artwork for a song memory.
  song_preview_url text, -- Optionally store a short playable preview URL.
  song_external_url text, -- Optionally store the provider URL for the track.
  audio_path text, -- Optionally store an uploaded voice memory audio URL.
  audio_duration_ms integer, -- Optionally store the recorded voice memory duration.
  movie_tmdb_id text, -- Optionally store the TMDb movie ID for a movie review memory.
  movie_title text, -- Optionally store the movie title snapshot.
  movie_year text, -- Optionally store the movie release year snapshot.
  movie_poster_url text, -- Optionally store the movie poster URL snapshot.
  movie_overview text, -- Optionally store the movie overview snapshot.
  movie_release_date date, -- Optionally store the movie release date snapshot.
  movie_vote_average numeric, -- Optionally store the public TMDb average rating snapshot.
  movie_review_rating numeric check (movie_review_rating between 0.5 and 5 and movie_review_rating * 2 = floor(movie_review_rating * 2)), -- Optionally store the friend's half-step star rating.
  movie_review_request_id uuid, -- Optionally link back to the request that produced this review.
  memory_prompt_request_id uuid, -- Optionally link back to the generic prompt that produced this memory.
  referenced_wall_post_id uuid references public.wall_posts(id) on delete set null, -- Optionally reference an existing Memory Card selected for a prompt.
  prompt_text text, -- Optionally store the prompt text that produced this memory.
  prompt_type text check (prompt_type in ('song', 'text', 'photo', 'photo_reference', 'voice')), -- Optionally store the prompt category that produced this memory.
  prompt_audio_path text, -- Optionally store the recorded prompt question audio URL.
  prompt_audio_duration_ms integer, -- Optionally store the recorded prompt question duration.
  created_at timestamptz not null default now(), -- Store when the wall post row was created.
  constraint wall_posts_has_subject check ( -- Enforce that exactly one kind of subject is set.
    (subject_user_id is not null and subject_contact_id is null) or -- Allow a real-user subject with no contact subject.
    (subject_user_id is null and subject_contact_id is not null) -- Allow a contact subject with no real-user subject.
  ) -- End the subject exclusivity check.
); -- End the wall_posts table definition.

alter table public.wall_posts enable row level security; -- Turn on row-level security for wall posts.

create policy "Authors can manage own wall posts" -- Name the policy that gives authors full control of their own posts.
  on public.wall_posts for all using (auth.uid() = author_user_id) with check (auth.uid() = author_user_id); -- Only allow the author to manage their own posts.

create policy "Prompt requesters can delete completed response posts"
  on public.wall_posts for delete
  using (
    auth.uid() = subject_user_id
    and (
      memory_prompt_request_id is not null
      or movie_review_request_id is not null
      or prompt_text is not null
      or prompt_type is not null
    )
  );

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

-- Memory replies — short comments attached to a visible memory.
create table public.memory_replies (
  id uuid primary key default uuid_generate_v4(),
  wall_post_id uuid not null references public.wall_posts(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  audio_path text,
  audio_duration_ms integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.memory_replies enable row level security;

create policy "Users can read replies on visible memories"
  on public.memory_replies for select
  using (
    exists (
      select 1 from public.wall_posts wp
      where wp.id = memory_replies.wall_post_id
        and (
          wp.author_user_id = auth.uid()
          or (wp.visibility = 'visible_to_subject' and wp.subject_user_id = auth.uid())
          or (
            wp.visibility = 'visible_to_subject'
            and wp.subject_contact_id is not null
            and exists (
              select 1 from public.contacts c
              where c.id = wp.subject_contact_id
                and c.linked_user_id = auth.uid()
            )
          )
        )
    )
  );

create policy "Users can reply to visible memories"
  on public.memory_replies for insert
  with check (
    auth.uid() = author_user_id
    and exists (
      select 1 from public.wall_posts wp
      where wp.id = wall_post_id
        and (
          wp.author_user_id = auth.uid()
          or (wp.visibility = 'visible_to_subject' and wp.subject_user_id = auth.uid())
          or (
            wp.visibility = 'visible_to_subject'
            and wp.subject_contact_id is not null
            and exists (
              select 1 from public.contacts c
              where c.id = wp.subject_contact_id
                and c.linked_user_id = auth.uid()
            )
          )
        )
    )
  );

create policy "Reply authors can delete own replies"
  on public.memory_replies for delete
  using (auth.uid() = author_user_id);

-- Curated profile wall items — existing memories the owner intentionally features on their own profile.
create table public.profile_wall_items (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  wall_post_id uuid not null references public.wall_posts(id) on delete cascade,
  replies_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  constraint profile_wall_items_unique unique (owner_user_id, wall_post_id)
);

alter table public.profile_wall_items enable row level security;

create policy "Users can read own profile wall items"
  on public.profile_wall_items for select
  using (auth.uid() = owner_user_id);

create policy "Friends can read profile wall items"
  on public.profile_wall_items for select
  using (
    exists (
      select 1 from public.friendships f
      where (f.user_low_id = auth.uid() and f.user_high_id = owner_user_id)
         or (f.user_high_id = auth.uid() and f.user_low_id = owner_user_id)
    )
  );

create policy "Users can insert own profile wall items"
  on public.profile_wall_items for insert
  with check (auth.uid() = owner_user_id);

create policy "Users can delete own profile wall items"
  on public.profile_wall_items for delete
  using (auth.uid() = owner_user_id);

-- Saved whiteboard layouts for memory wall pinboards.
create table public.wall_post_layouts (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  wall_context text not null,
  wall_context_id text not null,
  wall_post_id uuid not null references public.wall_posts(id) on delete cascade,
  x numeric not null default 0,
  y numeric not null default 0,
  scale numeric not null default 1,
  rotation numeric not null default 0,
  z_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wall_post_layouts_unique unique (owner_user_id, wall_context, wall_context_id, wall_post_id),
  constraint wall_post_layouts_context_check check (wall_context in ('contact_profile', 'shared_wall', 'my_profile', 'user_profile'))
);

alter table public.wall_post_layouts enable row level security;

create policy "Users can read own wall post layouts"
  on public.wall_post_layouts for select
  using (auth.uid() = owner_user_id);

create policy "Users can insert own wall post layouts"
  on public.wall_post_layouts for insert
  with check (auth.uid() = owner_user_id);

create policy "Users can update own wall post layouts"
  on public.wall_post_layouts for update
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

create policy "Users can delete own wall post layouts"
  on public.wall_post_layouts for delete
  using (auth.uid() = owner_user_id);

create policy "Friends can read featured profile wall posts"
  on public.wall_posts for select
  using (
    exists (
      select 1
      from public.profile_wall_items pwi
      join public.friendships f
        on (f.user_low_id = auth.uid() and f.user_high_id = pwi.owner_user_id)
        or (f.user_high_id = auth.uid() and f.user_low_id = pwi.owner_user_id)
      where pwi.wall_post_id = wall_posts.id
    )
  );

-- Gift notes — locked surprise notes that reveal into wall memories.
create table public.gift_notes (
  id uuid primary key default uuid_generate_v4(),
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  subject_contact_id uuid references public.contacts(id) on delete set null,
  unlock_date date not null,
  unlock_time time not null default '09:00',
  title text not null default 'A surprise note',
  status text not null default 'locked' check (status in ('locked', 'revealed', 'cancelled')),
  revealed_wall_post_id uuid references public.wall_posts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gift_notes_no_self check (author_user_id <> recipient_user_id)
);

alter table public.gift_notes add column if not exists unlock_time time not null default '09:00';

create table public.gift_note_bodies (
  gift_note_id uuid primary key references public.gift_notes(id) on delete cascade,
  body text not null
);

alter table public.gift_notes enable row level security;
alter table public.gift_note_bodies enable row level security;

create policy "Authors and recipients can read gift note metadata"
  on public.gift_notes for select
  using (auth.uid() = author_user_id or auth.uid() = recipient_user_id);

create policy "Authors can create gift notes"
  on public.gift_notes for insert
  with check (auth.uid() = author_user_id and author_user_id <> recipient_user_id);

create policy "Authors can cancel locked gift notes"
  on public.gift_notes for update
  using (auth.uid() = author_user_id and status = 'locked')
  with check (auth.uid() = author_user_id and status in ('locked', 'cancelled'));

create policy "Authors can read gift note bodies"
  on public.gift_note_bodies for select
  using (
    exists (
      select 1 from public.gift_notes gn
      where gn.id = gift_note_id
        and gn.author_user_id = auth.uid()
    )
  );

create policy "Authors can create gift note bodies"
  on public.gift_note_bodies for insert
  with check (
    exists (
      select 1 from public.gift_notes gn
      where gn.id = gift_note_id
        and gn.author_user_id = auth.uid()
        and gn.status = 'locked'
    )
  );

create or replace function public.reveal_due_gift_notes()
returns table (
  gift_note_id uuid,
  wall_post_id uuid,
  author_user_id uuid,
  recipient_user_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  gift record;
  inserted_post public.wall_posts%rowtype;
  author_name text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to reveal gift notes.';
  end if;

  for gift in
    select gn.*, gnb.body
    from public.gift_notes gn
    join public.gift_note_bodies gnb on gnb.gift_note_id = gn.id
    where gn.status = 'locked'
      and (gn.unlock_date + coalesce(gn.unlock_time, '09:00'::time)) <= now()
    for update of gn skip locked
  loop
    insert into public.wall_posts (
      author_user_id,
      subject_user_id,
      subject_contact_id,
      visibility,
      post_type,
      body,
      memory_date
    ) values (
      gift.author_user_id,
      gift.recipient_user_id,
      null,
      'visible_to_subject',
      'note',
      gift.body,
      gift.unlock_date
    )
    returning * into inserted_post;

    update public.gift_notes
    set status = 'revealed',
        revealed_wall_post_id = inserted_post.id,
        updated_at = now()
    where id = gift.id
      and status = 'locked';

    select coalesce(nullif(display_name, ''), 'Someone') into author_name
    from public.profiles
    where id = gift.author_user_id;

    insert into public.notifications (
      recipient_user_id,
      actor_user_id,
      type,
      reference_id,
      message,
      metadata
    ) values (
      gift.recipient_user_id,
      gift.author_user_id,
      'wall_post',
      inserted_post.id::text,
      coalesce(author_name, 'Someone') || '''s gift note unlocked for you',
      jsonb_build_object(
        'wallPostId', inserted_post.id,
        'giftNoteId', gift.id,
        'source', 'gift_note'
      )
    );

    gift_note_id := gift.id;
    wall_post_id := inserted_post.id;
    author_user_id := gift.author_user_id;
    recipient_user_id := gift.recipient_user_id;
    return next;
  end loop;
end;
$$;

grant execute on function public.reveal_due_gift_notes() to authenticated;

-- Movie review requests — friend-to-friend prompts to rate a movie.
create table public.movie_review_requests (
  id uuid primary key default uuid_generate_v4(),
  requester_user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  movie_tmdb_id text not null,
  movie_title text not null,
  movie_year text,
  movie_poster_url text,
  movie_overview text,
  movie_release_date date,
  movie_vote_average numeric,
  prompt text,
  prompt_audio_path text,
  prompt_audio_duration_ms integer,
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  review_rating numeric check (review_rating between 0.5 and 5 and review_rating * 2 = floor(review_rating * 2)),
  review_body text,
  review_audio_path text,
  review_audio_duration_ms integer,
  completed_wall_post_id uuid references public.wall_posts(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint movie_review_requests_no_self check (requester_user_id <> recipient_user_id)
);

alter table public.movie_review_requests enable row level security;

create policy "Users can read involved movie review requests"
  on public.movie_review_requests for select
  using (auth.uid() = requester_user_id or auth.uid() = recipient_user_id);

create policy "Friends can create movie review requests"
  on public.movie_review_requests for insert
  with check (
    auth.uid() = requester_user_id
    and requester_user_id <> recipient_user_id
    and status = 'pending'
    and exists (
      select 1 from public.friendships f
      where (f.user_low_id = requester_user_id and f.user_high_id = recipient_user_id)
         or (f.user_low_id = recipient_user_id and f.user_high_id = requester_user_id)
    )
  );

create policy "Requesters can cancel pending movie review requests"
  on public.movie_review_requests for update
  using (auth.uid() = requester_user_id and status = 'pending')
  with check (auth.uid() = requester_user_id and status in ('pending', 'cancelled'));

create policy "Recipients can complete pending movie review requests"
  on public.movie_review_requests for update
  using (auth.uid() = recipient_user_id and status = 'pending')
  with check (auth.uid() = recipient_user_id and status in ('pending', 'completed'));

alter table public.wall_posts
  add constraint wall_posts_movie_review_request_fk
  foreign key (movie_review_request_id) references public.movie_review_requests(id) on delete set null;

-- Memory prompt requests — generic friend-to-friend prompts that become wall memories.
create table public.memory_prompt_requests (
  id uuid primary key default uuid_generate_v4(),
  requester_user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  prompt_type text not null check (prompt_type in ('song', 'text', 'photo', 'photo_reference', 'voice')),
  prompt_text text not null,
  prompt_audio_path text,
  prompt_audio_duration_ms integer,
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  response_body text,
  response_song_provider text check (response_song_provider in ('apple', 'spotify')),
  response_song_provider_id text,
  response_song_title text,
  response_song_artist text,
  response_song_artwork_url text,
  response_song_preview_url text,
  response_song_external_url text,
  response_audio_path text,
  response_audio_duration_ms integer,
  referenced_wall_post_id uuid references public.wall_posts(id) on delete set null,
  completed_wall_post_id uuid references public.wall_posts(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint memory_prompt_requests_no_self check (requester_user_id <> recipient_user_id)
);

alter table public.memory_prompt_requests enable row level security;

create policy "Users can read involved memory prompt requests"
  on public.memory_prompt_requests for select
  using (auth.uid() = requester_user_id or auth.uid() = recipient_user_id);

create policy "Friends can create memory prompt requests"
  on public.memory_prompt_requests for insert
  with check (
    auth.uid() = requester_user_id
    and requester_user_id <> recipient_user_id
    and status = 'pending'
    and exists (
      select 1 from public.friendships f
      where (f.user_low_id = requester_user_id and f.user_high_id = recipient_user_id)
         or (f.user_low_id = recipient_user_id and f.user_high_id = requester_user_id)
    )
  );

create policy "Requesters can cancel pending memory prompt requests"
  on public.memory_prompt_requests for update
  using (auth.uid() = requester_user_id and status = 'pending')
  with check (auth.uid() = requester_user_id and status in ('pending', 'cancelled'));

create policy "Recipients can complete pending memory prompt requests"
  on public.memory_prompt_requests for update
  using (auth.uid() = recipient_user_id and status = 'pending')
  with check (auth.uid() = recipient_user_id and status in ('pending', 'completed'));

-- Saved prompt ideas users can reuse when sending memory prompts.
create table public.saved_memory_prompts (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  prompt_type text not null check (prompt_type in ('song', 'text', 'photo', 'photo_reference', 'voice')),
  prompt_text text not null,
  category text,
  source text not null default 'user' check (source in ('user', 'curated', 'ai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.saved_memory_prompts enable row level security;

create policy "Users can read own saved prompts"
  on public.saved_memory_prompts for select
  using (auth.uid() = owner_user_id);

create policy "Users can insert own saved prompts"
  on public.saved_memory_prompts for insert
  with check (auth.uid() = owner_user_id);

create policy "Users can update own saved prompts"
  on public.saved_memory_prompts for update
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

create policy "Users can delete own saved prompts"
  on public.saved_memory_prompts for delete
  using (auth.uid() = owner_user_id);

alter table public.wall_posts
  add constraint wall_posts_memory_prompt_request_fk
  foreign key (memory_prompt_request_id) references public.memory_prompt_requests(id) on delete set null;

-- Calendar events — Premium-created dates owned by one user.
create table public.calendar_events (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  subject_user_id uuid references public.profiles(id) on delete cascade,
  subject_contact_id uuid references public.contacts(id) on delete cascade,
  event_type text not null check (event_type in ('reminder', 'birthday', 'anniversary', 'custom')),
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

-- Calendar event shares let a creator show one event on a connected friend's
-- calendar while keeping recipient reminder preferences separate.
create table public.calendar_event_shares (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  reminders_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_event_shares_no_self check (owner_user_id <> recipient_user_id),
  constraint calendar_event_shares_unique_recipient unique (event_id, recipient_user_id)
);

alter table public.calendar_event_shares enable row level security;

create policy "Owners can read own calendar event shares"
  on public.calendar_event_shares for select
  using (auth.uid() = owner_user_id);

create policy "Recipients can read own calendar event shares"
  on public.calendar_event_shares for select
  using (auth.uid() = recipient_user_id);

create policy "Owners can create shares for own calendar events"
  on public.calendar_event_shares for insert
  with check (
    auth.uid() = owner_user_id
    and recipient_user_id <> auth.uid()
    and exists (
      select 1
      from public.calendar_events ce
      where ce.id = event_id
        and ce.owner_user_id = auth.uid()
    )
  );

create policy "Owners can delete own calendar event shares"
  on public.calendar_event_shares for delete
  using (
    auth.uid() = owner_user_id
    and exists (
      select 1
      from public.calendar_events ce
      where ce.id = event_id
        and ce.owner_user_id = auth.uid()
    )
  );

create policy "Shared recipients can read shared calendar events"
  on public.calendar_events for select
  using (
    exists (
      select 1
      from public.calendar_event_shares ces
      where ces.event_id = calendar_events.id
        and ces.recipient_user_id = auth.uid()
    )
  );

create or replace function public.set_calendar_event_share_reminders(
  p_share_id uuid,
  p_reminders_enabled boolean
)
returns public.calendar_event_shares
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_share public.calendar_event_shares%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in to update shared calendar reminders.';
  end if;

  update public.calendar_event_shares
  set reminders_enabled = p_reminders_enabled,
      updated_at = now()
  where id = p_share_id
    and recipient_user_id = auth.uid()
  returning * into updated_share;

  if updated_share.id is null then
    raise exception 'Shared calendar event not found.';
  end if;

  return updated_share;
end;
$$;

grant execute on function public.set_calendar_event_share_reminders(uuid, boolean) to authenticated;

-- Mark the storage section for memory images.
-- Tell the reader to create the bucket manually in the dashboard.

-- Mark the start of the indexes section.
-- Explain that these indexes speed up the most common lookup queries.
create index idx_contacts_owner on public.contacts(owner_user_id); -- Speed up queries by contact owner.
create index idx_contacts_hero_wall_post on public.contacts(hero_wall_post_id);
create index idx_friendships_low on public.friendships(user_low_id); -- Speed up friendship lookups by low user ID.
create index idx_friendships_high on public.friendships(user_high_id); -- Speed up friendship lookups by high user ID.
create index idx_wall_posts_subject_user on public.wall_posts(subject_user_id); -- Speed up wall-post lookups by subject user.
create index idx_wall_posts_subject_contact on public.wall_posts(subject_contact_id); -- Speed up wall-post lookups by subject contact.
create index idx_wall_posts_author on public.wall_posts(author_user_id); -- Speed up wall-post lookups by author.
create index idx_profile_wall_items_owner_created on public.profile_wall_items(owner_user_id, created_at desc);
create index idx_profile_wall_items_wall_post on public.profile_wall_items(wall_post_id);
create index idx_wall_post_layouts_context on public.wall_post_layouts(owner_user_id, wall_context, wall_context_id);
create index idx_wall_post_layouts_wall_post on public.wall_post_layouts(wall_post_id);
create index idx_gift_notes_author on public.gift_notes(author_user_id, status, unlock_date);
create index idx_gift_notes_recipient on public.gift_notes(recipient_user_id, status, unlock_date);
create index idx_gift_notes_unlock on public.gift_notes(status, unlock_date);
create index idx_movie_review_requests_requester on public.movie_review_requests(requester_user_id, status, created_at desc);
create index idx_movie_review_requests_recipient on public.movie_review_requests(recipient_user_id, status, created_at desc);
create index idx_movie_review_requests_wall_post on public.movie_review_requests(completed_wall_post_id);
create index idx_movie_review_requests_expires on public.movie_review_requests(recipient_user_id, status, expires_at);
create index idx_memory_prompt_requests_requester on public.memory_prompt_requests(requester_user_id, status, created_at desc);
create index idx_memory_prompt_requests_recipient on public.memory_prompt_requests(recipient_user_id, status, created_at desc);
create index idx_memory_prompt_requests_wall_post on public.memory_prompt_requests(completed_wall_post_id);
create index idx_memory_prompt_requests_expires on public.memory_prompt_requests(recipient_user_id, status, expires_at);
create index idx_memory_prompt_requests_reference on public.memory_prompt_requests(referenced_wall_post_id);
create index idx_wall_posts_memory_prompt_request on public.wall_posts(memory_prompt_request_id);
create index idx_wall_posts_referenced_wall_post on public.wall_posts(referenced_wall_post_id);
create index idx_memory_replies_wall_post on public.memory_replies(wall_post_id, created_at);
create index idx_memory_replies_author on public.memory_replies(author_user_id, created_at desc);
create index idx_saved_memory_prompts_owner_updated on public.saved_memory_prompts(owner_user_id, updated_at desc);
create index idx_profiles_friend_code on public.profiles(friend_code); -- Speed up friend-code lookup queries.
create index idx_calendar_events_owner_date on public.calendar_events(owner_user_id, event_date);
create index idx_calendar_events_subject_user on public.calendar_events(subject_user_id);
create index idx_calendar_events_subject_contact on public.calendar_events(subject_contact_id);
create index idx_calendar_event_shares_owner on public.calendar_event_shares(owner_user_id);
create index idx_calendar_event_shares_recipient on public.calendar_event_shares(recipient_user_id);
create index idx_calendar_event_shares_event on public.calendar_event_shares(event_id);

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
  type text not null, -- 'wall_post' | 'friend_request' | 'contact_update' | 'calendar_event'
  reference_id text, -- ID of the related wall_post, friendship, etc.
  message text not null,
  read boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "Users can read own notifications"
  on public.notifications for select using (auth.uid() = recipient_user_id);

create policy "Users can update own notifications"
  on public.notifications for update using (auth.uid() = recipient_user_id);

create policy "Authenticated users can insert notifications"
  on public.notifications for insert
  to authenticated
  with check (
    actor_user_id = auth.uid()
    and recipient_user_id <> auth.uid()
  );

create index idx_notifications_recipient on public.notifications(recipient_user_id);

-- Calendar event reactions — one thumbs up/down per tagged recipient per event.
create table public.calendar_event_reactions (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete set null,
  value text not null check (value in ('up', 'down')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_event_reactions_unique_user unique (event_id, user_id)
);

alter table public.calendar_event_reactions enable row level security;

create policy "Calendar event reaction participants can read"
  on public.calendar_event_reactions for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.calendar_events ce
      where ce.id = event_id and ce.owner_user_id = auth.uid()
    )
    or exists (
      select 1 from public.calendar_event_shares ces
      where ces.event_id = calendar_event_reactions.event_id
        and ces.recipient_user_id = auth.uid()
    )
  );

create policy "Shared recipients can create own calendar reactions"
  on public.calendar_event_reactions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.calendar_event_shares ces
      where ces.event_id = calendar_event_reactions.event_id
        and ces.recipient_user_id = auth.uid()
    )
    and (
      notification_id is null
      or exists (
        select 1 from public.notifications n
        where n.id = notification_id
          and n.recipient_user_id = auth.uid()
          and n.type = 'calendar_event'
          and n.reference_id = calendar_event_reactions.event_id::text
      )
    )
  );

create policy "Shared recipients can update own calendar reactions"
  on public.calendar_event_reactions for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.calendar_event_shares ces
      where ces.event_id = calendar_event_reactions.event_id
        and ces.recipient_user_id = auth.uid()
    )
  );

create policy "Shared recipients can delete own calendar reactions"
  on public.calendar_event_reactions for delete
  using (auth.uid() = user_id);

create index idx_calendar_event_reactions_event on public.calendar_event_reactions(event_id);
create index idx_calendar_event_reactions_user on public.calendar_event_reactions(user_id);

-- Premium purchase events validated by the purchase Edge Function.
create table if not exists public.premium_purchase_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id text not null,
  transaction_id text not null unique,
  purchase_token text,
  platform text not null default 'ios',
  premium_until timestamptz not null,
  raw_purchase jsonb not null default '{}'::jsonb,
  validated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.premium_purchase_events enable row level security;

drop policy if exists "Users can read own premium purchase events" on public.premium_purchase_events;
create policy "Users can read own premium purchase events"
  on public.premium_purchase_events for select
  using (auth.uid() = user_id);

create index if not exists idx_premium_purchase_events_user on public.premium_purchase_events(user_id);

-- Migrations: add columns that were added after initial table creation.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS premium_until timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata jsonb not null default '{}'::jsonb;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS post_type text not null default 'note';
ALTER TABLE public.wall_posts DROP CONSTRAINT IF EXISTS wall_posts_post_type_check;
ALTER TABLE public.wall_posts ADD CONSTRAINT wall_posts_post_type_check CHECK (post_type in ('note', 'polaroid', 'media', 'song', 'movie', 'voice'));
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS date_stamp boolean not null default false;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS filter text;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS back_text text;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS video_path text;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS video_muted boolean not null default false;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS memory_date date;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS location_name text;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS song_provider text check (song_provider in ('apple', 'spotify'));
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS song_provider_id text;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS song_title text;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS song_artist text;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS song_artwork_url text;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS song_preview_url text;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS song_external_url text;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS audio_path text;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS audio_duration_ms integer;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS movie_tmdb_id text;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS movie_title text;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS movie_year text;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS movie_poster_url text;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS movie_overview text;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS movie_release_date date;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS movie_vote_average numeric;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS movie_review_rating numeric;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS movie_review_request_id uuid;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS memory_prompt_request_id uuid;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS referenced_wall_post_id uuid references public.wall_posts(id) on delete set null;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS prompt_text text;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS prompt_type text;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS prompt_audio_path text;
ALTER TABLE public.wall_posts ADD COLUMN IF NOT EXISTS prompt_audio_duration_ms integer;
ALTER TABLE public.wall_posts DROP CONSTRAINT IF EXISTS wall_posts_prompt_type_check;
ALTER TABLE public.wall_posts ADD CONSTRAINT wall_posts_prompt_type_check CHECK (prompt_type is null or prompt_type in ('song', 'text', 'photo', 'photo_reference', 'voice'));
ALTER TABLE public.memory_prompt_requests DROP CONSTRAINT IF EXISTS memory_prompt_requests_prompt_type_check;
ALTER TABLE public.memory_prompt_requests ADD CONSTRAINT memory_prompt_requests_prompt_type_check CHECK (prompt_type in ('song', 'text', 'photo', 'photo_reference', 'voice'));
ALTER TABLE public.memory_replies ADD COLUMN IF NOT EXISTS audio_path text;
ALTER TABLE public.memory_replies ADD COLUMN IF NOT EXISTS audio_duration_ms integer;
ALTER TABLE public.memory_prompt_requests ADD COLUMN IF NOT EXISTS prompt_audio_path text;
ALTER TABLE public.memory_prompt_requests ADD COLUMN IF NOT EXISTS prompt_audio_duration_ms integer;
ALTER TABLE public.memory_prompt_requests ADD COLUMN IF NOT EXISTS response_audio_path text;
ALTER TABLE public.memory_prompt_requests ADD COLUMN IF NOT EXISTS response_audio_duration_ms integer;
ALTER TABLE public.movie_review_requests ADD COLUMN IF NOT EXISTS prompt_audio_path text;
ALTER TABLE public.movie_review_requests ADD COLUMN IF NOT EXISTS prompt_audio_duration_ms integer;
ALTER TABLE public.movie_review_requests ADD COLUMN IF NOT EXISTS review_rating numeric;
ALTER TABLE public.movie_review_requests ADD COLUMN IF NOT EXISTS review_audio_path text;
ALTER TABLE public.movie_review_requests ADD COLUMN IF NOT EXISTS review_audio_duration_ms integer;
ALTER TABLE public.wall_posts ALTER COLUMN movie_review_rating TYPE numeric USING movie_review_rating::numeric;
ALTER TABLE public.wall_posts DROP CONSTRAINT IF EXISTS wall_posts_movie_review_rating_check;
ALTER TABLE public.wall_posts ADD CONSTRAINT wall_posts_movie_review_rating_check CHECK (
  movie_review_rating is null
  or (movie_review_rating between 0.5 and 5 and movie_review_rating * 2 = floor(movie_review_rating * 2))
);
ALTER TABLE public.movie_review_requests DROP CONSTRAINT IF EXISTS movie_review_requests_review_rating_check;
ALTER TABLE public.movie_review_requests ALTER COLUMN review_rating TYPE numeric USING review_rating::numeric;
ALTER TABLE public.movie_review_requests ADD CONSTRAINT movie_review_requests_review_rating_check CHECK (
  review_rating is null
  or (review_rating between 0.5 and 5 and review_rating * 2 = floor(review_rating * 2))
);
UPDATE public.wall_posts SET post_type = 'polaroid' WHERE image_path IS NOT NULL AND post_type = 'note';

-- Enable realtime on wall_posts and contacts so clients receive live updates.
alter publication supabase_realtime add table public.wall_posts;
alter publication supabase_realtime add table public.memory_replies;
alter publication supabase_realtime add table public.profile_wall_items;
alter publication supabase_realtime add table public.wall_post_layouts;
alter publication supabase_realtime add table public.gift_notes;
alter publication supabase_realtime add table public.movie_review_requests;
alter publication supabase_realtime add table public.memory_prompt_requests;
alter publication supabase_realtime add table public.saved_memory_prompts;
alter publication supabase_realtime add table public.contacts;
alter publication supabase_realtime add table public.friend_requests;
alter publication supabase_realtime add table public.contact_private_notes;
alter publication supabase_realtime add table public.contact_private_note_blocks;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.calendar_events;
alter publication supabase_realtime add table public.calendar_event_shares;
alter publication supabase_realtime add table public.calendar_event_reactions;
