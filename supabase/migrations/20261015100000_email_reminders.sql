-- Applied to project ysugwqqjhtppxtehuhew on 2026-10-15 (migrations "email_reminders", "email_reminders_cron_token").
-- Email reminders: per-user preferences, a log so nothing is sent twice,
-- and the functions the hourly "send-reminders" Edge Function calls.

-- 1. Preferences (one row per user; users manage their own row)
create table if not exists public.email_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  checkin_reminder boolean not null default true,
  goal_reminder boolean not null default true,
  order_reminder boolean not null default true,
  reminder_hour smallint not null default 20 check (reminder_hour between 0 and 23),
  timezone text not null default 'Africa/Lagos',
  unsub_token uuid not null default gen_random_uuid() unique,
  updated_at timestamptz not null default now()
);
alter table public.email_prefs enable row level security;

create policy "Own email prefs: read" on public.email_prefs for select
  to authenticated using ((select auth.uid()) = user_id);
create policy "Own email prefs: add" on public.email_prefs for insert
  to authenticated with check ((select auth.uid()) = user_id);
create policy "Own email prefs: change" on public.email_prefs for update
  to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.email_prefs from anon;
grant select, insert, update on public.email_prefs to authenticated;

-- Reject time zones Postgres doesn't know, so the hourly job never errors.
create or replace function private.valid_timezone(tz text)
returns boolean language sql stable set search_path = ''
as $$ select exists (select 1 from pg_catalog.pg_timezone_names where name = tz) $$;
alter table public.email_prefs add constraint email_prefs_timezone_valid check (private.valid_timezone(timezone));

-- 2. What has been sent (never readable by app users)
create table if not exists private.email_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  day date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, day)
);
alter table private.email_log enable row level security;
revoke all on private.email_log from public, anon, authenticated;

-- 3. Who should get what right now. Called hourly by the Edge Function
--    (service role only). Everything is worked out in each user's own time zone.
create or replace function public.reminder_queue()
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  result jsonb;
begin
  -- Give every confirmed user a preferences row (defaults on).
  insert into public.email_prefs (user_id)
  select au.id from auth.users au
  where au.email_confirmed_at is not null
  on conflict (user_id) do nothing;

  with u as (
    select
      au.id as user_id,
      au.email,
      coalesce(nullif(btrim(au.raw_user_meta_data->>'full_name'), ''), '') as name,
      au.created_at,
      au.email_confirmed_at,
      p.checkin_reminder, p.goal_reminder, p.order_reminder, p.reminder_hour,
      p.timezone, p.unsub_token,
      (now() at time zone p.timezone) as local_now
    from auth.users au
    join public.email_prefs p on p.user_id = au.id
    where au.email_confirmed_at is not null
      and au.email is not null
      and (au.banned_until is null or au.banned_until < now())
  ),
  l as (
    select u.*, u.local_now::date as today, extract(hour from u.local_now)::int as hour,
           extract(day from u.local_now)::int as dom
    from u
  ),
  evening as (
    select l.* from l where l.hour = l.reminder_hour
  ),
  checkin as (
    select e.user_id,
      jsonb_build_object(
        'streak', (
          with d as (
            select distinct x.date from (
              select ce.date from public.checkin_entries ce where ce.user_id = e.user_id and ce.date between e.today - 60 and e.today - 1
              union
              select de.date from public.day_entries de where de.user_id = e.user_id and de.date between e.today - 60 and e.today - 1
                and (de.hours > 0 or de.outreach > 0 or cardinality(de.platforms) > 0 or cardinality(de.activities) > 0)
            ) x
          )
          select count(*) from (select d.date, row_number() over (order by d.date desc) rn from d) s
          where s.date = e.today - s.rn::int
        )
      ) as info
    from evening e
    where e.checkin_reminder
      -- only people who have used check-ins at least once, or joined in the last 14 days
      and (exists (select 1 from public.checkin_entries ce where ce.user_id = e.user_id)
           or e.created_at > now() - interval '14 days')
      and not exists (select 1 from public.checkin_entries ce where ce.user_id = e.user_id and ce.date = e.today)
      and not exists (select 1 from public.day_entries de where de.user_id = e.user_id and de.date = e.today
                       and (de.hours > 0 or de.outreach > 0 or cardinality(de.platforms) > 0 or cardinality(de.activities) > 0))
      and not exists (select 1 from private.email_log g where g.user_id = e.user_id and g.kind = 'checkin' and g.day = e.today)
  ),
  goal as (
    select e.user_id,
      jsonb_build_object(
        'month', case when e.dom >= 25 then to_char(e.today + interval '1 month', 'YYYY-MM') else to_char(e.today, 'YYYY-MM') end,
        'month_name', case when e.dom >= 25 then trim(to_char(e.today + interval '1 month', 'FMMonth')) else trim(to_char(e.today, 'FMMonth')) end,
        'closes', case when e.dom >= 25 then to_char(e.today + interval '1 month', 'YYYY-MM') || '-05' else to_char(e.today, 'YYYY-MM') || '-05' end,
        'last_call', e.dom = 3
      ) as info
    from evening e
    where e.goal_reminder
      and e.dom in (25, 3)
      and not exists (
        select 1 from public.monthly_goals mg where mg.user_id = e.user_id
          and mg.month = case when e.dom >= 25 then to_char(e.today + interval '1 month', 'YYYY-MM') else to_char(e.today, 'YYYY-MM') end
          and mg.amount > 0)
      and not exists (select 1 from private.email_log g where g.user_id = e.user_id and g.kind = 'goal' and g.day = e.today)
  ),
  orders as (
    select e.user_id,
      jsonb_agg(jsonb_build_object(
        'title', o.title,
        'client', coalesce(c.name, ''),
        'due', o.due_date,
        'days_late', e.today - o.due_date
      ) order by o.due_date) as info
    from evening e
    join public.orders o on o.user_id = e.user_id
    left join public.clients c on c.id = o.client_id
    where e.order_reminder
      and o.status in ('Waiting on client', 'Active', 'On hold')
      and o.due_date is not null
      and (o.due_date = e.today + 1 or (e.today - o.due_date) in (1, 3, 7))
      and not exists (select 1 from private.email_log g where g.user_id = e.user_id and g.kind = 'orders' and g.day = e.today)
    group by e.user_id
  ),
  welcome as (
    select l.user_id from l
    where l.email_confirmed_at > now() - interval '2 days'
      and l.created_at >= timestamptz '2026-10-15 00:00:00+00'
      and not exists (select 1 from private.email_log g where g.user_id = l.user_id and g.kind = 'welcome')
  )
  select coalesce(jsonb_agg(row), '[]'::jsonb) into result
  from (
    select jsonb_build_object(
      'user_id', l.user_id,
      'email', l.email,
      'name', l.name,
      'today', l.today,
      'unsub_token', l.unsub_token,
      'welcome', w.user_id is not null,
      'checkin', ch.info,
      'goal', g.info,
      'orders', o.info
    ) as row
    from l
    left join welcome w on w.user_id = l.user_id
    left join checkin ch on ch.user_id = l.user_id
    left join goal g on g.user_id = l.user_id
    left join orders o on o.user_id = l.user_id
    where w.user_id is not null or ch.user_id is not null or g.user_id is not null or o.user_id is not null
  ) q;

  return result;
end;
$$;

-- Record that an email went out (service role only).
create or replace function public.reminder_mark_sent(p_user_id uuid, p_kinds text[], p_day date)
returns void language sql volatile security definer set search_path = ''
as $$
  insert into private.email_log (user_id, kind, day)
  select p_user_id, k, p_day from unnest(p_kinds) k
  on conflict do nothing;
$$;

-- One-click unsubscribe from an email link. Needs only the secret token in the link.
create or replace function public.email_unsubscribe(p_token uuid)
returns boolean language plpgsql volatile security definer set search_path = ''
as $$
declare
  n int;
begin
  update public.email_prefs
     set checkin_reminder = false, goal_reminder = false, order_reminder = false, updated_at = now()
   where unsub_token = p_token;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.reminder_queue() from public, anon, authenticated;
revoke all on function public.reminder_mark_sent(uuid, text[], date) from public, anon, authenticated;
revoke all on function public.email_unsubscribe(uuid) from public;
grant execute on function public.reminder_queue() to service_role;
grant execute on function public.reminder_mark_sent(uuid, text[], date) to service_role;
grant execute on function public.email_unsubscribe(uuid) to anon, authenticated;
revoke all on function private.valid_timezone(text) from public;
grant execute on function private.valid_timezone(text) to authenticated, service_role;

-- 4. A random token only the scheduled job knows; the Edge Function checks it
--    (applied as migration "email_reminders_cron_token").
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'reminders_cron_token', 'Shared by pg_cron and the send-reminders function')
where not exists (select 1 from vault.secrets where name = 'reminders_cron_token');

create or replace function public.reminder_token_ok(p_token text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select p_token is not null and p_token = (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_token' limit 1);
$$;
revoke all on function public.reminder_token_ok(text) from public, anon, authenticated;
grant execute on function public.reminder_token_ok(text) to service_role;

-- 5. Run every hour (applied as migrations "enable_pg_net_pg_cron" and "schedule_send_reminders").
create extension if not exists pg_net;
create extension if not exists pg_cron;
select cron.schedule(
  'send-reminders-hourly',
  '0 * * * *',
  $cron$
  select net.http_post(
    url := 'https://ysugwqqjhtppxtehuhew.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('token', (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_token')),
    timeout_milliseconds := 120000
  );
  $cron$
);
