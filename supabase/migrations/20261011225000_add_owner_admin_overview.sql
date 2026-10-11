-- Applied to project ysugwqqjhtppxtehuhew on 2026-10-11 (migration "add_owner_admin_overview").
-- Owner-only app stats. private.admins lists who may read them; the public
-- wrappers run as the caller, so anyone else gets "Not allowed" (42501).

create table if not exists private.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table private.admins enable row level security;
revoke all on private.admins from public, anon, authenticated;

insert into private.admins (user_id)
select id from auth.users where email = 'arinolae92@gmail.com'
on conflict do nothing;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from private.admins a where a.user_id = (select auth.uid()));
$$;

create or replace function private.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  result jsonb;
begin
  if (select auth.uid()) is null or not private.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  with u as (
    select
      au.email,
      nullif(btrim(au.raw_user_meta_data->>'full_name'), '') as name,
      au.created_at,
      au.email_confirmed_at is not null as confirmed,
      au.last_sign_in_at,
      greatest(
        au.last_sign_in_at,
        (select max(s.updated_at) from auth.sessions s where s.user_id = au.id),
        (select max(o.updated_at) from public.orders o where o.user_id = au.id),
        (select max(c.created_at) from public.clients c where c.user_id = au.id),
        (select max(p.created_at) from public.payments p where p.user_id = au.id),
        (select max(e.created_at) from public.checkin_entries e where e.user_id = au.id)
      ) as last_active,
      (select count(*) from public.clients c where c.user_id = au.id) as clients,
      (select count(*) from public.orders o where o.user_id = au.id) as orders,
      (select count(*) from public.payments p where p.user_id = au.id) as payments,
      (select count(*) from public.checkin_entries e where e.user_id = au.id) as checkins,
      (select count(*) from storage.objects so
         where so.bucket_id = 'client-files'
           and (storage.foldername(so.name))[1] = au.id::text) as files,
      coalesce((select us.onboarded from public.user_settings us where us.user_id = au.id), false) as onboarded
    from auth.users au
  )
  select jsonb_build_object(
    'generated_at', now(),
    'total_users', (select count(*) from u),
    'confirmed_users', (select count(*) from u where confirmed),
    'new_7d', (select count(*) from u where created_at > now() - interval '7 days'),
    'new_30d', (select count(*) from u where created_at > now() - interval '30 days'),
    'active_7d', (select count(*) from u where last_active > now() - interval '7 days'),
    'using_app', (select count(*) from u where orders + clients + checkins > 0),
    'signups_90d', (select coalesce(jsonb_agg(created_at order by created_at), '[]'::jsonb)
                    from u where created_at > now() - interval '90 days'),
    'totals', jsonb_build_object(
      'clients', (select count(*) from public.clients),
      'orders', (select count(*) from public.orders),
      'completed_orders', (select count(*) from public.orders where status = 'Completed'),
      'payments', (select count(*) from public.payments),
      'expenses', (select count(*) from public.expenses),
      'checkins', (select count(*) from public.checkin_entries),
      'files', (select count(*) from storage.objects where bucket_id = 'client-files'),
      'storage_bytes', (select coalesce(sum((metadata->>'size')::bigint), 0)
                        from storage.objects where bucket_id = 'client-files')
    ),
    'users', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
              from (select * from u order by created_at desc limit 300) x)
  ) into result;

  return result;
end;
$$;

create or replace function public.is_admin()
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.is_admin(); $$;

create or replace function public.admin_overview()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.admin_overview(); $$;

revoke all on function private.is_admin() from public, anon;
revoke all on function private.admin_overview() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.admin_overview() from public, anon;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.admin_overview() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_overview() to authenticated;
