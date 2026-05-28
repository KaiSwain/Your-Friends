-- Official Your Friends account support.
-- Run this after creating the real Supabase Auth user/profile for the official account,
-- then set that profile's `is_official = true` and `is_team_admin = true`.

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

do $$
declare
  official_user_id uuid;
  profile_row record;
begin
  select id into official_user_id
  from public.profiles
  where is_official = true
  order by created_at asc
  limit 1;

  if official_user_id is null then
    raise notice 'No official profile is marked yet. Set is_official=true later to auto-backfill connections.';
    return;
  end if;

  for profile_row in
    select id from public.profiles where id <> official_user_id
  loop
    perform public.connect_official_account_pair(profile_row.id, official_user_id);
  end loop;
end;
$$;
