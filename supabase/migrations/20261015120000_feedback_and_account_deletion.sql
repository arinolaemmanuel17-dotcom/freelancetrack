-- Applied to project ysugwqqjhtppxtehuhew on 2026-10-15 (migration "feedback_and_account_deletion").
-- Feedback messages (only reachable through the "feedback" Edge Function) and
-- helpers the "delete-account" Edge Function uses. All service-role only.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  name text not null default '',
  kind text not null check (kind in ('bug', 'idea', 'question', 'other')),
  message text not null check (char_length(btrim(message)) between 1 and 4000),
  status text not null default 'new' check (status in ('new', 'replied', 'closed')),
  reply text,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_idx on public.feedback (created_at desc);
create index if not exists feedback_user_idx on public.feedback (user_id, created_at desc);
alter table public.feedback enable row level security;
revoke all on public.feedback from public, anon, authenticated;
grant select, insert, update on public.feedback to service_role;

-- Is this user one of the app owners? (service role only)
create or replace function public.service_is_admin(p_user uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from private.admins a where a.user_id = p_user) $$;

-- Emails of the app owners, for feedback alerts. (service role only)
create or replace function public.service_admin_emails()
returns text[] language sql stable security definer set search_path = ''
as $$ select coalesce(array_agg(u.email), '{}') from private.admins a join auth.users u on u.id = a.user_id where u.email is not null $$;

-- Every file a user has uploaded, so their account can be fully deleted. (service role only)
create or replace function public.service_user_files(p_user uuid)
returns text[] language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(o.name), '{}') from storage.objects o
  where o.bucket_id = 'client-files' and (storage.foldername(o.name))[1] = p_user::text
$$;

revoke all on function public.service_is_admin(uuid) from public, anon, authenticated;
revoke all on function public.service_admin_emails() from public, anon, authenticated;
revoke all on function public.service_user_files(uuid) from public, anon, authenticated;
grant execute on function public.service_is_admin(uuid) to service_role;
grant execute on function public.service_admin_emails() to service_role;
grant execute on function public.service_user_files(uuid) to service_role;
