create table if not exists public.saved_memory_prompts (
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

drop policy if exists "Users can read own saved prompts" on public.saved_memory_prompts;
create policy "Users can read own saved prompts"
  on public.saved_memory_prompts for select
  using (auth.uid() = owner_user_id);

drop policy if exists "Users can insert own saved prompts" on public.saved_memory_prompts;
create policy "Users can insert own saved prompts"
  on public.saved_memory_prompts for insert
  with check (auth.uid() = owner_user_id);

drop policy if exists "Users can update own saved prompts" on public.saved_memory_prompts;
create policy "Users can update own saved prompts"
  on public.saved_memory_prompts for update
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

drop policy if exists "Users can delete own saved prompts" on public.saved_memory_prompts;
create policy "Users can delete own saved prompts"
  on public.saved_memory_prompts for delete
  using (auth.uid() = owner_user_id);

create index if not exists idx_saved_memory_prompts_owner_updated
  on public.saved_memory_prompts(owner_user_id, updated_at desc);

do $$
begin
  alter publication supabase_realtime add table public.saved_memory_prompts;
exception
  when duplicate_object then null;
end $$;
