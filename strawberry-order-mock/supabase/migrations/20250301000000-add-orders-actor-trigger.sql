-- Fill orders.user_id / agency_id / agency_name from created_by_email or user_id.
-- Uses SECURITY DEFINER to avoid RLS issues when INSERTing orders.
create or replace function public.fill_orders_actor_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_user_id uuid;
  v_agency_id uuid;
  v_agency_name text;
begin
  v_email := lower(trim(new.created_by_email));

  if new.user_id is not null then
    select agency_id, agency_name
      into v_agency_id, v_agency_name
    from profiles
    where id = new.user_id
    limit 1;
  end if;

  if (new.user_id is null or v_agency_id is null or v_agency_name is null)
     and v_email is not null
     and v_email <> '' then
    select id, agency_id, agency_name
      into v_user_id, v_agency_id, v_agency_name
    from profiles
    where lower(trim(email)) = v_email
    limit 1;

    if v_user_id is null then
      select id
        into v_user_id
      from auth.users
      where lower(trim(email)) = v_email
      limit 1;

      if v_user_id is not null then
        select agency_id, agency_name
          into v_agency_id, v_agency_name
        from profiles
        where id = v_user_id
        limit 1;
      end if;
    end if;
  end if;

  if new.user_id is null then
    new.user_id := v_user_id;
  end if;

  if new.agency_id is null then
    if v_agency_id is not null then
      new.agency_id := v_agency_id;
    elsif v_agency_name is not null then
      select id
        into v_agency_id
      from agencies
      where lower(trim(name)) = lower(trim(v_agency_name))
      limit 1;
      if v_agency_id is not null then
        new.agency_id := v_agency_id;
      end if;
    end if;
  end if;

  if new.agency_name is null then
    if new.agency_id is not null then
      select name
        into v_agency_name
      from agencies
      where id = new.agency_id
      limit 1;
      new.agency_name := v_agency_name;
    elsif v_agency_name is not null then
      new.agency_name := v_agency_name;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_fill_orders_actor_snapshot on public.orders;

create trigger trg_fill_orders_actor_snapshot
before insert on public.orders
for each row
execute function public.fill_orders_actor_snapshot();
