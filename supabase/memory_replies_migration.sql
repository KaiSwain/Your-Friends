create table if not exists public.memory_replies (
  id uuid primary key default uuid_generate_v4(),
  wall_post_id uuid not null references public.wall_posts(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.memory_replies enable row level security;

drop policy if exists "Users can read replies on visible memories" on public.memory_replies;
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

drop policy if exists "Users can reply to visible memories" on public.memory_replies;
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

drop policy if exists "Reply authors can delete own replies" on public.memory_replies;
create policy "Reply authors can delete own replies"
  on public.memory_replies for delete
  using (auth.uid() = author_user_id);

create index if not exists idx_memory_replies_wall_post on public.memory_replies(wall_post_id, created_at);
create index if not exists idx_memory_replies_author on public.memory_replies(author_user_id, created_at desc);

do $$
begin
  alter publication supabase_realtime add table public.memory_replies;
exception
  when duplicate_object then null;
end $$;
