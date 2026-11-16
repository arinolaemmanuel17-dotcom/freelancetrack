-- Month rules (approved 15 Nov 2026, see money-rules).
-- A month stays open until the end of the 5th of the next month, in the user's own
-- time zone (public.email_prefs.timezone, default Africa/Lagos). Money that has
-- arrived and expenses in a closed month are locked; they can only be changed through
-- public.correct_closed_record(), which logs the old value, the new value and a reason.
-- Nothing existing is moved or rewritten.

-- 1. The user's own "today" and the first day of their oldest open month
create or replace function private.local_today(p_uid uuid)
returns date language sql stable security definer set search_path = ''
as $$
  select (now() at time zone coalesce((select e.timezone from public.email_prefs e where e.user_id = p_uid), 'Africa/Lagos'))::date
$$;

create or replace function private.open_floor(p_uid uuid)
returns date language sql stable security definer set search_path = ''
as $$
  select case
    when extract(day from t.d) <= 5 then (date_trunc('month', t.d) - interval '1 month')::date
    else date_trunc('month', t.d)::date
  end
  from (select private.local_today(p_uid) as d) t
$$;

-- 2. Correction history (users can read their own; rows are only written by the function below)
create table if not exists public.corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  table_name text not null check (table_name in ('payments', 'expenses', 'orders')),
  record_id uuid not null,
  action text not null check (action in ('update', 'delete')),
  month text not null,
  old_values jsonb not null,
  new_values jsonb,
  reason text not null check (length(btrim(reason)) >= 3),
  created_at timestamptz not null default now()
);
create index if not exists corrections_user_idx on public.corrections (user_id, created_at desc);
alter table public.corrections enable row level security;
create policy "Own corrections: read" on public.corrections for select
  to authenticated using ((select auth.uid()) = user_id);
revoke all on public.corrections from anon;
revoke insert, update, delete on public.corrections from authenticated;
grant select on public.corrections to authenticated;

-- 3. Payments: money that has arrived is locked once its month closes
create or replace function private.enforce_payment_months()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid;
  v_floor date;
  v_today date;
begin
  -- Changes made by the database itself (a client or order being deleted) and logged corrections pass.
  if pg_trigger_depth() > 1 or coalesce(current_setting('app.correcting', true), '') = '1' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  v_uid := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  v_floor := private.open_floor(v_uid);
  v_today := private.local_today(v_uid);

  if tg_op = 'DELETE' then
    if old.status = 'Received' and old.date < v_floor then
      raise exception 'This payment is from a closed month. Use "Correct a closed month" and give a reason.' using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.status = 'Received' and old.date < v_floor then
    raise exception 'This payment is from a closed month. Use "Correct a closed month" and give a reason.' using errcode = 'check_violation';
  end if;

  -- Expected money is not in yet, so only money that has arrived is dated and locked.
  if new.status = 'Received' then
    if new.date < v_floor then
      raise exception 'That date is in a closed month. Money that has arrived must be dated from % onward.', to_char(v_floor, 'FMDD Mon YYYY') using errcode = 'check_violation';
    end if;
    if new.date > v_today then
      raise exception 'A payment that has arrived can''t be dated in the future. Use Expected for money still to come.' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_payment_months on public.payments;
create trigger enforce_payment_months before insert or update or delete on public.payments
  for each row execute function private.enforce_payment_months();

-- 4. Expenses: same rule, by the day it was spent
create or replace function private.enforce_expense_months()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid;
  v_floor date;
  v_today date;
begin
  if pg_trigger_depth() > 1 or coalesce(current_setting('app.correcting', true), '') = '1' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  v_uid := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  v_floor := private.open_floor(v_uid);
  v_today := private.local_today(v_uid);

  if tg_op = 'DELETE' then
    if old.date < v_floor then
      raise exception 'This expense is from a closed month. Use "Correct a closed month" and give a reason.' using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.date < v_floor then
    raise exception 'This expense is from a closed month. Use "Correct a closed month" and give a reason.' using errcode = 'check_violation';
  end if;

  if new.date < v_floor then
    raise exception 'That date is in a closed month. Expenses must be dated from % onward.', to_char(v_floor, 'FMDD Mon YYYY') using errcode = 'check_violation';
  end if;
  if new.date > v_today then
    raise exception 'An expense can''t be dated in the future.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_expense_months on public.expenses;
create trigger enforce_expense_months before insert or update or delete on public.expenses
  for each row execute function private.enforce_expense_months();

-- 5. Orders: an order belongs to the month it started
create or replace function private.enforce_order_months()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid;
  v_floor date;
  v_today date;
  v_old public.orders%rowtype;
  v_existing boolean := false;
begin
  if pg_trigger_depth() > 1 or coalesce(current_setting('app.correcting', true), '') = '1' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  v_uid := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  v_floor := private.open_floor(v_uid);
  v_today := private.local_today(v_uid);

  if tg_op = 'DELETE' then
    if exists (select 1 from public.payments p where p.order_id = old.id and p.user_id = old.user_id and p.status = 'Received' and p.date < v_floor) then
      raise exception 'This order has money recorded in a closed month. Use "Correct a closed month" and give a reason.' using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    v_old := old;
    v_existing := true;
  else
    -- An upsert of an order that already exists arrives here as an INSERT, so treat it as the change it is.
    select * into v_old from public.orders o where o.id = new.id and o.user_id = new.user_id;
    v_existing := found;
  end if;

  if not v_existing then
    if new.start_date is not null and new.start_date < v_floor then
      raise exception 'That start date is in a closed month. Orders can start from % onward.', to_char(v_floor, 'FMDD Mon YYYY') using errcode = 'check_violation';
    end if;
    if new.completed_at is not null then
      if new.completed_at > v_today then
        raise exception 'The completed date can''t be in the future.' using errcode = 'check_violation';
      end if;
      if new.completed_at < v_floor or (new.start_date is not null and new.completed_at < new.start_date) then
        raise exception 'The completed date has to be in a month that is still open, and not before the start date.' using errcode = 'check_violation';
      end if;
    end if;
    return new;
  end if;

  -- Existing order. Status, due date, notes, checklist and new payments always stay allowed.
  if new.start_date is distinct from v_old.start_date then
    if (new.start_date is not null and new.start_date < v_floor) or (v_old.start_date is not null and v_old.start_date < v_floor) then
      raise exception 'An order can''t be moved into or out of a closed month. Use "Correct a closed month" and give a reason.' using errcode = 'check_violation';
    end if;
  end if;
  if v_old.start_date is not null and v_old.start_date < v_floor and v_old.status = 'Completed'
     and new.price is distinct from v_old.price then
    raise exception 'The price is fixed once an order is completed and its month has closed. Use "Correct a closed month" and give a reason.' using errcode = 'check_violation';
  end if;
  if new.completed_at is distinct from v_old.completed_at and new.completed_at is not null then
    if new.completed_at > v_today then
      raise exception 'The completed date can''t be in the future.' using errcode = 'check_violation';
    end if;
    if new.start_date is not null and new.completed_at < new.start_date then
      raise exception 'The completed date can''t be before the start date.' using errcode = 'check_violation';
    end if;
    -- A completed order with no date yet (older records) can be filled in with the real, past date.
    if not (v_old.status = 'Completed' and v_old.completed_at is null) and new.completed_at < v_floor then
      raise exception 'The completed date has to be in a month that is still open.' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_order_months on public.orders;
create trigger enforce_order_months before insert or update or delete on public.orders
  for each row execute function private.enforce_order_months();

-- 6. Correct a closed month: the only way through the lock, and it is always logged
create or replace function public.correct_closed_record(p_table text, p_id uuid, p_action text, p_changes jsonb, p_reason text)
returns void language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date;
  v_old jsonb;
  v_new jsonb;
  v_month text;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 3 then
    raise exception 'Please type a reason for the correction.' using errcode = 'check_violation';
  end if;
  if p_table not in ('payments', 'expenses', 'orders') or p_action not in ('update', 'delete') then
    raise exception 'Not something that can be corrected.' using errcode = 'check_violation';
  end if;
  p_changes := coalesce(p_changes, '{}'::jsonb);
  v_today := private.local_today(v_uid);
  perform set_config('app.correcting', '1', true);

  if p_table = 'payments' then
    select to_jsonb(x) into v_old from public.payments x where x.id = p_id and x.user_id = v_uid for update;
    if v_old is null then raise exception 'That payment was not found.' using errcode = 'no_data_found'; end if;
    v_month := to_char((v_old->>'date')::date, 'YYYY-MM');
    if p_action = 'delete' then
      delete from public.payments where id = p_id and user_id = v_uid;
    else
      update public.payments set
        date = coalesce((p_changes->>'date')::date, date),
        amount = coalesce((p_changes->>'amount')::numeric, amount),
        currency = coalesce(p_changes->>'currency', currency),
        rate_to_base = coalesce((p_changes->>'rate_to_base')::numeric, rate_to_base),
        method = coalesce(p_changes->>'method', method),
        status = coalesce(p_changes->>'status', status),
        notes = coalesce(p_changes->>'notes', notes)
      where id = p_id and user_id = v_uid;
      select to_jsonb(x) into v_new from public.payments x where x.id = p_id;
      if v_new->>'status' = 'Received' and (v_new->>'date')::date > v_today then
        raise exception 'A payment that has arrived can''t be dated in the future.' using errcode = 'check_violation';
      end if;
    end if;

  elsif p_table = 'expenses' then
    select to_jsonb(x) into v_old from public.expenses x where x.id = p_id and x.user_id = v_uid for update;
    if v_old is null then raise exception 'That expense was not found.' using errcode = 'no_data_found'; end if;
    v_month := to_char((v_old->>'date')::date, 'YYYY-MM');
    if p_action = 'delete' then
      delete from public.expenses where id = p_id and user_id = v_uid;
    else
      update public.expenses set
        date = coalesce((p_changes->>'date')::date, date),
        amount = coalesce((p_changes->>'amount')::numeric, amount),
        currency = coalesce(p_changes->>'currency', currency),
        rate_to_base = coalesce((p_changes->>'rate_to_base')::numeric, rate_to_base),
        category = coalesce(p_changes->>'category', category),
        method = coalesce(p_changes->>'method', method),
        notes = coalesce(p_changes->>'notes', notes),
        order_id = case when p_changes ? 'order_id' then (p_changes->>'order_id')::uuid else order_id end
      where id = p_id and user_id = v_uid;
      select to_jsonb(x) into v_new from public.expenses x where x.id = p_id;
      if (v_new->>'date')::date > v_today then
        raise exception 'An expense can''t be dated in the future.' using errcode = 'check_violation';
      end if;
    end if;

  else
    select to_jsonb(x) into v_old from public.orders x where x.id = p_id and x.user_id = v_uid for update;
    if v_old is null then raise exception 'That order was not found.' using errcode = 'no_data_found'; end if;
    v_month := to_char(coalesce((v_old->>'start_date')::date, v_today), 'YYYY-MM');
    if p_action = 'delete' then
      delete from public.orders where id = p_id and user_id = v_uid;
    else
      update public.orders set
        start_date = case when p_changes ? 'start_date' then (p_changes->>'start_date')::date else start_date end,
        price = case when p_changes ? 'price' then (p_changes->>'price')::numeric else price end,
        completed_at = case when p_changes ? 'completed_at' then (p_changes->>'completed_at')::date else completed_at end,
        updated_at = now()
      where id = p_id and user_id = v_uid;
      select to_jsonb(x) into v_new from public.orders x where x.id = p_id;
      if (v_new->>'completed_at')::date > v_today then
        raise exception 'The completed date can''t be in the future.' using errcode = 'check_violation';
      end if;
    end if;
  end if;

  perform set_config('app.correcting', '0', true);
  insert into public.corrections (user_id, table_name, record_id, action, month, old_values, new_values, reason)
  values (v_uid, p_table, p_id, p_action, v_month, v_old, case when p_action = 'delete' then null else v_new end, btrim(p_reason));
end;
$$;

-- 7. Erase everything (Settings > Data): money in closed months can only be removed this way
create or replace function public.erase_my_records()
returns void language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  perform set_config('app.correcting', '1', true);
  delete from public.payments where user_id = v_uid;
  delete from public.expenses where user_id = v_uid;
  delete from public.orders where user_id = v_uid;
  delete from public.corrections where user_id = v_uid;
  perform set_config('app.correcting', '0', true);
end;
$$;

revoke all on function public.correct_closed_record(text, uuid, text, jsonb, text) from public, anon;
revoke all on function public.erase_my_records() from public, anon;
grant execute on function public.correct_closed_record(text, uuid, text, jsonb, text) to authenticated;
grant execute on function public.erase_my_records() to authenticated;
revoke all on function private.local_today(uuid) from public, anon, authenticated;
revoke all on function private.open_floor(uuid) from public, anon, authenticated;
revoke all on function private.enforce_payment_months() from public, anon, authenticated;
revoke all on function private.enforce_expense_months() from public, anon, authenticated;
revoke all on function private.enforce_order_months() from public, anon, authenticated;
