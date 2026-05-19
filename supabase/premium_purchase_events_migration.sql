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
