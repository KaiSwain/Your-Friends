alter table public.profiles add column if not exists premium_paid_until timestamptz;
alter table public.profiles add column if not exists premium_free_until timestamptz;
alter table public.profiles add column if not exists premium_free_granted_by_user_id uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists premium_free_granted_at timestamptz;

update public.profiles
set premium_paid_until = premium_until
where premium_until is not null
  and premium_paid_until is null
  and premium_free_until is null;

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

drop policy if exists "Users can read own premium QR grants" on public.premium_qr_grants;

create policy "Users can read own premium QR grants"
  on public.premium_qr_grants
  for select
  using (auth.uid() = grantor_user_id or auth.uid() = recipient_user_id);

create index if not exists idx_premium_qr_grants_grantor
  on public.premium_qr_grants(grantor_user_id);

create index if not exists idx_premium_qr_grants_recipient
  on public.premium_qr_grants(recipient_user_id);

create index if not exists idx_premium_qr_grants_grantor_active
  on public.premium_qr_grants(grantor_user_id, recipient_premium_until);

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
