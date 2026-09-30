-- ============================================================
-- いちご発注システム Supabase 完全セットアップSQL
-- Supabase SQL Editor に貼り付けて実行してください
-- ============================================================

-- ① profiles テーブル（auth.users と紐づく）
-- ※ Supabase Auth を使う場合、auth.users は自動生成されます
-- ※ profiles は手動で作成が必要です

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'user',
  agency_id uuid,
  agency_name text,
  email text,
  order_disabled boolean default false,
  created_at timestamptz not null default now()
);

-- ② agencies テーブル（代理店マスタ）
create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  created_at timestamptz default now()
);

-- ③ orders テーブル
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique,
  user_id uuid references auth.users(id),
  created_by_email text,
  product_name text not null,
  product_id uuid,
  pieces_per_sheet integer,
  quantity integer not null,
  postal_and_address text not null,
  recipient_name text not null,
  phone_number text not null,
  delivery_date date,
  delivery_time_note text,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'canceled')),
  agency_id uuid,
  agency_name text,
  email_sent_at timestamptz,
  email_message_id text,
  unit_price integer,
  tax_rate integer,
  subtotal integer,
  tax_amount integer,
  total_amount integer,
  created_at timestamptz not null default now()
);

-- ④ product_prices テーブル（商品価格マスタ）
create table if not exists public.product_prices (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  pieces_per_sheet integer,
  unit_price integer not null check (unit_price > 0),
  tax_rate integer not null default 8 check (tax_rate >= 0 and tax_rate <= 100),
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now()
);

create index if not exists product_prices_lookup_idx
  on public.product_prices (product_name, pieces_per_sheet, effective_from desc);

-- ⑤ admin_audit_logs テーブル（管理操作ログ）
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  performed_by_email text,
  action text not null,
  target_email text,
  target_user_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- ⑥ 注文番号採番関数（例: ORD-20260930-001 形式）
create or replace function public.generate_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date text;
  v_seq  integer;
  v_num  text;
begin
  v_date := to_char(now() at time zone 'Asia/Tokyo', 'YYYYMMDD');

  -- 当日分のカウント（advisory lock で重複防止）
  perform pg_advisory_xact_lock(hashtext('generate_order_number'));

  select coalesce(max(
    cast(substring(order_number from '\d+$') as integer)
  ), 0) + 1
    into v_seq
  from orders
  where order_number like 'ORD-' || v_date || '-%';

  v_num := 'ORD-' || v_date || '-' || lpad(v_seq::text, 3, '0');
  return v_num;
end;
$$;

-- ⑦ orders 挿入時に user_id / agency_id / agency_name を自動補完するトリガー
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

-- ⑧ auth.users にユーザー作成時に profiles.email を自動同期するトリガー
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

-- ⑨ RLS（Row Level Security）設定
-- profiles: 自分のレコードのみ読み書き可。サービスロールは全件OK
alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- orders: 自分の注文のみ読み書き可。サービスロールは全件OK
alter table public.orders enable row level security;

drop policy if exists "Users can read own orders" on public.orders;
create policy "Users can read own orders"
  on public.orders for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own orders" on public.orders;
create policy "Users can insert own orders"
  on public.orders for insert
  with check (auth.uid() = user_id);

-- agencies: 全員読み取り可（変更はサービスロールのみ）
alter table public.agencies enable row level security;

drop policy if exists "Anyone can read agencies" on public.agencies;
create policy "Anyone can read agencies"
  on public.agencies for select
  using (true);

-- ============================================================
-- ここまでで基本セットアップ完了
-- 次に商品価格マスタのシードデータを投入してください（別ファイル）
-- ============================================================
