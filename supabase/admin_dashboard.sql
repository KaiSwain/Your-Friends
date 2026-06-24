-- Admin dashboard support: lightweight activity tracking + an aggregate stats
-- function gated to team admins. Run this in the Supabase SQL editor.
--
-- Security model:
--   * touch_last_seen() lets a signed-in user stamp their own last_seen_at.
--   * admin_app_stats() returns aggregate-only JSON and raises unless the
--     caller's profile has is_team_admin = true. No raw user content leaves
--     the database, and RLS stays intact because callers only ever invoke
--     these SECURITY DEFINER functions (never the service-role key).

-- 1. Activity tracking ------------------------------------------------------
alter table public.profiles add column if not exists last_seen_at timestamptz;
create index if not exists idx_profiles_last_seen on public.profiles(last_seen_at);

create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;

grant execute on function public.touch_last_seen() to authenticated;

-- 2. Growth helpers ---------------------------------------------------------
-- Internal-only helpers (NOT granted to clients). They are invoked from
-- admin_app_stats(), which is itself gated to team admins. p_table is
-- whitelisted and p_where is only ever supplied as a fixed internal string,
-- so the dynamic SQL has no external injection surface.

-- Bucketed time series: returns [{ bucket, count }] for the last p_points
-- buckets of size p_bucket ('day' | 'month' | 'year'), zero-filled.
create or replace function public.admin_growth_series(
  p_table text,
  p_bucket text,
  p_points integer,
  p_where text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  step text;
  filter_clause text;
begin
  if p_table not in ('profiles', 'wall_posts', 'premium_purchase_events') then
    raise exception 'invalid table';
  end if;
  if p_bucket not in ('day', 'month', 'year') then
    raise exception 'invalid bucket';
  end if;

  step := '1 ' || p_bucket;
  filter_clause := case when p_where is null then '' else 'and (' || p_where || ')' end;

  execute format($q$
    with buckets as (
      select generate_series(
        date_trunc(%L, now()) - (%L::interval * (%s - 1)),
        date_trunc(%L, now()),
        %L::interval
      ) as b
    ),
    data as (
      select date_trunc(%L, created_at) as b, count(*) as c
      from public.%I
      where created_at >= date_trunc(%L, now()) - (%L::interval * (%s - 1)) %s
      group by 1
    )
    select coalesce(
      jsonb_agg(jsonb_build_object('bucket', buckets.b, 'count', coalesce(data.c, 0)) order by buckets.b),
      '[]'::jsonb
    )
    from buckets left join data on data.b = buckets.b
  $q$,
    p_bucket, step, p_points,
    p_bucket, step,
    p_bucket,
    p_table,
    p_bucket, step, p_points, filter_clause
  ) into result;

  return result;
end;
$$;

-- Period-over-period counts: today/yesterday, this/last week, month, year.
create or replace function public.admin_period_counts(
  p_table text,
  p_where text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  filter_clause text;
begin
  if p_table not in ('profiles', 'wall_posts', 'premium_purchase_events') then
    raise exception 'invalid table';
  end if;
  filter_clause := case when p_where is null then '' else 'and (' || p_where || ')' end;

  execute format($q$
    select jsonb_build_object(
      'today', count(*) filter (where created_at >= date_trunc('day', now())),
      'yesterday', count(*) filter (where created_at >= date_trunc('day', now()) - interval '1 day' and created_at < date_trunc('day', now())),
      'this_week', count(*) filter (where created_at >= date_trunc('week', now())),
      'last_week', count(*) filter (where created_at >= date_trunc('week', now()) - interval '1 week' and created_at < date_trunc('week', now())),
      'this_month', count(*) filter (where created_at >= date_trunc('month', now())),
      'last_month', count(*) filter (where created_at >= date_trunc('month', now()) - interval '1 month' and created_at < date_trunc('month', now())),
      'this_year', count(*) filter (where created_at >= date_trunc('year', now())),
      'last_year', count(*) filter (where created_at >= date_trunc('year', now()) - interval '1 year' and created_at < date_trunc('year', now()))
    )
    from public.%I
    where true %s
  $q$, p_table, filter_clause) into result;

  return result;
end;
$$;

-- Lock the helpers down: only the function owner (used by admin_app_stats via
-- SECURITY DEFINER) may run them. Clients can never call them directly.
revoke all on function public.admin_growth_series(text, text, integer, text) from public;
revoke all on function public.admin_period_counts(text, text) from public;

-- 3. Aggregate stats (team-admin only) --------------------------------------
create or replace function public.admin_app_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  total_users integer;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_team_admin = true
  ) then
    raise exception 'Not authorized';
  end if;

  select count(*) into total_users from public.profiles;

  result := jsonb_build_object(
    'generated_at', now(),
    'total_users', total_users,

    'users', (
      select jsonb_build_object(
        'total', total_users,
        'new_today', count(*) filter (where created_at >= date_trunc('day', now())),
        'new_7d', count(*) filter (where created_at >= now() - interval '7 days'),
        'new_30d', count(*) filter (where created_at >= now() - interval '30 days'),
        'with_push_token', count(*) filter (where push_token is not null),
        'with_birthday', count(*) filter (where birthday is not null)
      )
      from public.profiles
    ),

    'active', (
      select jsonb_build_object(
        'dau', count(*) filter (where last_seen_at >= now() - interval '1 day'),
        'wau', count(*) filter (where last_seen_at >= now() - interval '7 days'),
        'mau', count(*) filter (where last_seen_at >= now() - interval '30 days')
      )
      from public.profiles
    ),

    -- Bucketed time series for the growth explorer. Each metric has day (30),
    -- month (12), and year (5) views; purchases count production only.
    'series', jsonb_build_object(
      'signups', jsonb_build_object(
        'day', public.admin_growth_series('profiles', 'day', 30),
        'month', public.admin_growth_series('profiles', 'month', 12),
        'year', public.admin_growth_series('profiles', 'year', 5)
      ),
      'memories', jsonb_build_object(
        'day', public.admin_growth_series('wall_posts', 'day', 30),
        'month', public.admin_growth_series('wall_posts', 'month', 12),
        'year', public.admin_growth_series('wall_posts', 'year', 5)
      ),
      'purchases', jsonb_build_object(
        'day', public.admin_growth_series('premium_purchase_events', 'day', 30, $prod$raw_purchase->>'appleEnvironment' = 'Production'$prod$),
        'month', public.admin_growth_series('premium_purchase_events', 'month', 12, $prod$raw_purchase->>'appleEnvironment' = 'Production'$prod$),
        'year', public.admin_growth_series('premium_purchase_events', 'year', 5, $prod$raw_purchase->>'appleEnvironment' = 'Production'$prod$)
      )
    ),

    -- Period-over-period comparison counts for each metric.
    'compare', jsonb_build_object(
      'signups', public.admin_period_counts('profiles'),
      'memories', public.admin_period_counts('wall_posts'),
      'purchases', public.admin_period_counts('premium_purchase_events', $prod$raw_purchase->>'appleEnvironment' = 'Production'$prod$)
    ),

    'memories', (
      select jsonb_build_object(
        'total', count(*),
        'new_today', count(*) filter (where created_at >= date_trunc('day', now())),
        'new_7d', count(*) filter (where created_at >= now() - interval '7 days'),
        'new_30d', count(*) filter (where created_at >= now() - interval '30 days'),
        'avg_per_user', round(count(*)::numeric / nullif(total_users, 0), 2),
        'by_type', (
          select coalesce(jsonb_object_agg(post_type, c), '{}'::jsonb)
          from (select post_type, count(*) c from public.wall_posts group by post_type) t
        )
      )
      from public.wall_posts
    ),

    'replies_total', (select count(*) from public.memory_replies),

    'social', (
      with fc as (
        select uid, count(*) c
        from (
          select user_low_id as uid from public.friendships
          union all
          select user_high_id from public.friendships
        ) u
        group by uid
      )
      select jsonb_build_object(
        'friendships_total', (select count(*) from public.friendships),
        'avg_friends_per_user', round(2.0 * (select count(*) from public.friendships) / nullif(total_users, 0), 2),
        'users_with_friends', (select count(*) from fc),
        'users_zero_friends', total_users - (select count(*) from fc),
        'users_5plus', (select count(*) from fc where c >= 5),
        'users_10plus', (select count(*) from fc where c >= 10)
      )
    ),

    'friend_requests', (
      select jsonb_build_object(
        'pending', count(*) filter (where status = 'pending'),
        'accepted', count(*) filter (where status = 'accepted'),
        'declined', count(*) filter (where status = 'declined'),
        'acceptance_rate', round(
          100.0 * count(*) filter (where status = 'accepted')
          / nullif(count(*) filter (where status in ('accepted', 'declined')), 0), 1)
      )
      from public.friend_requests
    ),

    'movie_requests', (
      select jsonb_build_object(
        'pending', count(*) filter (where status = 'pending'),
        'completed', count(*) filter (where status = 'completed'),
        'cancelled', count(*) filter (where status = 'cancelled'),
        'completion_rate', round(100.0 * count(*) filter (where status = 'completed') / nullif(count(*), 0), 1)
      )
      from public.movie_review_requests
    ),

    'memory_prompts', (
      select jsonb_build_object(
        'pending', count(*) filter (where status = 'pending'),
        'completed', count(*) filter (where status = 'completed'),
        'cancelled', count(*) filter (where status = 'cancelled'),
        'completion_rate', round(100.0 * count(*) filter (where status = 'completed') / nullif(count(*), 0), 1),
        'by_type', (
          select coalesce(jsonb_object_agg(prompt_type, c), '{}'::jsonb)
          from (select prompt_type, count(*) c from public.memory_prompt_requests group by prompt_type) t
        )
      )
      from public.memory_prompt_requests
    ),

    'monetization', (
      -- Users who have at least one *production* (real, App Store) purchase.
      -- Sandbox/TestFlight test purchases also set premium_paid_until, so we use
      -- this set to separate genuine paying customers from test transactions.
      with prod_buyers as (
        select distinct user_id
        from public.premium_purchase_events
        where raw_purchase->>'appleEnvironment' = 'Production'
      )
      select jsonb_build_object(
        'premium_active_total', count(*) filter (
          where greatest(
            coalesce(premium_until, '-infinity'::timestamptz),
            coalesce(premium_paid_until, '-infinity'::timestamptz),
            coalesce(premium_free_until, '-infinity'::timestamptz)
          ) > now()
        ),
        -- Real paying customers: active paid date AND a production purchase on record.
        'premium_paid_active', count(*) filter (
          where premium_paid_until > now() and p.id in (select user_id from prod_buyers)
        ),
        -- Active "paid" status that only came from sandbox/TestFlight testing.
        'premium_paid_sandbox', count(*) filter (
          where premium_paid_until > now() and p.id not in (select user_id from prod_buyers)
        ),
        'premium_free_active', count(*) filter (where premium_free_until > now()),
        -- Manual/comped grants set only premium_until (e.g. via the SQL editor),
        -- so count anyone active that has neither a paid nor a free-grant date.
        'premium_comped_active', count(*) filter (
          where premium_until > now()
            and coalesce(premium_paid_until, '-infinity'::timestamptz) <= now()
            and coalesce(premium_free_until, '-infinity'::timestamptz) <= now()
        ),
        -- Conversion uses real production buyers only, never sandbox tests.
        'conversion_rate', round(
          100.0 * count(*) filter (
            where premium_paid_until > now() and p.id in (select user_id from prod_buyers)
          ) / nullif(total_users, 0), 1)
      )
      from public.profiles p
    ),

    'purchases', (
      select jsonb_build_object(
        'total', count(*),
        'production', count(*) filter (where raw_purchase->>'appleEnvironment' = 'Production'),
        'sandbox', count(*) filter (where raw_purchase->>'appleEnvironment' = 'Sandbox'),
        'last_30d', count(*) filter (where created_at >= now() - interval '30 days'),
        'production_last_30d', count(*) filter (
          where created_at >= now() - interval '30 days'
            and raw_purchase->>'appleEnvironment' = 'Production'
        ),
        -- Plan breakdown for real production purchases only.
        'by_product', (
          select coalesce(jsonb_object_agg(product_id, c), '{}'::jsonb)
          from (
            select product_id, count(*) c
            from public.premium_purchase_events
            where raw_purchase->>'appleEnvironment' = 'Production'
            group by product_id
          ) t
        )
      )
      from public.premium_purchase_events
    ),

    'referrals_total', (select count(*) from public.referrals),
    'qr_grants_total', (select count(*) from public.premium_qr_grants),

    'activation', (
      select jsonb_build_object(
        'pct_created_memory', round(
          100.0 * (select count(distinct author_user_id) from public.wall_posts) / nullif(total_users, 0), 1),
        'pct_added_friend', round(
          100.0 * (
            select count(*) from (
              select user_low_id as uid from public.friendships
              union
              select user_high_id from public.friendships
            ) u
          ) / nullif(total_users, 0), 1)
      )
    ),

    'top_authors', (
      select coalesce(jsonb_agg(x order by x.memories desc), '[]'::jsonb)
      from (
        select p.display_name, cnt.c as memories
        from (
          select author_user_id, count(*) c
          from public.wall_posts
          group by author_user_id
          order by c desc
          limit 10
        ) cnt
        join public.profiles p on p.id = cnt.author_user_id
      ) x
    ),

    'content', jsonb_build_object(
      'gift_notes', (
        select coalesce(jsonb_object_agg(status, c), '{}'::jsonb)
        from (select status, count(*) c from public.gift_notes group by status) t
      ),
      'calendar_events', (select count(*) from public.calendar_events),
      'private_notes', (select count(*) from public.contact_private_notes)
    )
  );

  return result;
end;
$$;

grant execute on function public.admin_app_stats() to authenticated;
