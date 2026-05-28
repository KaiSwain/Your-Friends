drop policy if exists "Prompt requesters can delete completed response posts" on public.wall_posts;

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
