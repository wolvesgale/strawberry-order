-- Ensure profiles.email is populated from auth.users on insert/update.
create or replace function public.sync_profile_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update
    set email = coalesce(public.profiles.email, excluded.email);

  return new;
end;
$$;

drop trigger if exists trg_sync_profile_email_from_auth on auth.users;

create trigger trg_sync_profile_email_from_auth
after insert or update of email on auth.users
for each row
execute function public.sync_profile_email_from_auth();

-- Backfill helper for orders.user_id / agency_id from profiles.email.
create or replace function public.backfill_orders_actor_snapshot()
returns table(updated_user_id_count integer, updated_agency_id_count integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  update orders as o
  set user_id = p.id
  from profiles as p
  where o.user_id is null
    and o.created_by_email is not null
    and lower(trim(o.created_by_email)) = lower(trim(p.email));

  get diagnostics updated_user_id_count = row_count;

  update orders as o
  set agency_id = p.agency_id
  from profiles as p
  where o.agency_id is null
    and o.created_by_email is not null
    and lower(trim(o.created_by_email)) = lower(trim(p.email))
    and p.agency_id is not null;

  get diagnostics updated_agency_id_count = row_count;

  return;
end;
$$;

-- Optional: price history table for unit price backfill and future pricing.
create table if not exists public.product_prices (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  unit_price integer not null,
  tax_rate integer not null default 10,
  effective_from timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists product_prices_product_name_effective_from_idx
  on public.product_prices (product_name, effective_from desc);

create or replace function public.backfill_orders_price_history()
returns table(updated_unit_price_count integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  update orders as o
  set unit_price = p.unit_price,
      tax_rate = coalesce(o.tax_rate, p.tax_rate)
  from lateral (
    select unit_price, tax_rate
    from product_prices
    where product_name = o.product_name
      and effective_from <= o.created_at
    order by effective_from desc
    limit 1
  ) as p
  where o.unit_price is null
    and o.product_name is not null;

  get diagnostics updated_unit_price_count = row_count;

  return;
end;
$$;
