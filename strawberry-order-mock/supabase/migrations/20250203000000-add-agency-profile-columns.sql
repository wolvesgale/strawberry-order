-- Ensure agency lookup tables/columns exist (nullable for backward compatibility).
create table if not exists agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

alter table if exists profiles
  add column if not exists agency_id uuid,
  add column if not exists agency_name text,
  add column if not exists email text;
