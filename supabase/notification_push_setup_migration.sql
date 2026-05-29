alter table public.profiles
  add column if not exists push_token text;

drop policy if exists "Authenticated users can insert notifications" on public.notifications;

create policy "Authenticated users can insert notifications"
  on public.notifications for insert
  to authenticated
  with check (
    actor_user_id = auth.uid()
    and recipient_user_id <> auth.uid()
  );

notify pgrst, 'reload schema';
