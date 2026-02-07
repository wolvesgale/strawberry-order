-- Backfill user_id / agency_id / agency_name on orders using created_by_email.
-- Run once in Supabase SQL editor with service role (RLS bypass).
-- Rollback: keep this transaction open to validate results, then either COMMIT,
-- or issue ROLLBACK to revert all changes made in this script.

-- Dry-run counts
select count(*) as orders_missing_user_id
from orders
where user_id is null
  and created_by_email is not null;

select count(*) as orders_missing_agency_id
from orders
where agency_id is null
  and created_by_email is not null;

select count(*) as orders_missing_email
from orders
where created_by_email is null;

begin;

-- 1) Fill user_id by matching created_by_email to profiles.email.
update orders as o
set user_id = p.id
from profiles as p
where o.user_id is null
  and o.created_by_email is not null
  and lower(trim(o.created_by_email)) = lower(trim(p.email));

-- 1-b) If profiles.email does not exist or is not populated,
-- use auth.users to map created_by_email -> user id instead.
update orders as o
set user_id = u.id
from auth.users as u
where o.user_id is null
  and o.created_by_email is not null
  and lower(trim(o.created_by_email)) = lower(trim(u.email));

-- 2) Fill agency_id / agency_name via profiles lookup.
update orders as o
set
  agency_id = p.agency_id,
  agency_name = coalesce(a.name, p.agency_name)
from profiles as p
left join agencies as a on a.id = p.agency_id
where o.agency_id is null
  and o.user_id = p.id;

-- 2-b) If profiles.agency_id is null but profiles.agency_name is present,
-- try to resolve an existing agencies.id by name.
update orders as o
set
  agency_id = a.id,
  agency_name = coalesce(o.agency_name, a.name)
from profiles as p
join agencies as a on lower(trim(a.name)) = lower(trim(p.agency_name))
where o.agency_id is null
  and o.user_id = p.id
  and p.agency_id is null
  and p.agency_name is not null;

-- Optional: fill agency_name when agency_id exists but name is missing.
update orders as o
set agency_name = a.name
from agencies as a
where o.agency_id = a.id
  and o.agency_name is null;

commit;
