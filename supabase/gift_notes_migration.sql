create table if not exists public.gift_notes (
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

alter table public.gift_notes
  add column if not exists unlock_time time not null default '09:00';

create table if not exists public.gift_note_bodies (
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

create index if not exists idx_gift_notes_author on public.gift_notes(author_user_id, status, unlock_date);
create index if not exists idx_gift_notes_recipient on public.gift_notes(recipient_user_id, status, unlock_date);
create index if not exists idx_gift_notes_unlock on public.gift_notes(status, unlock_date);

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
