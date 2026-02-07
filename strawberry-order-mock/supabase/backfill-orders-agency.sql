-- Backfill agency_id / agency_name on orders using created_by_email
-- Run in Supabase SQL editor when needed.

update orders as o
set
  agency_id = p.agency_id,
  agency_name = coalesce(a.name, p.agency_name)
from profiles as p
left join agencies as a on a.id = p.agency_id
where
  o.agency_id is null
  and o.agency_name is null
  and o.created_by_email is not null
  and lower(trim(o.created_by_email)) = lower(trim(p.email));

-- Optional: fill agency_name when agency_id exists but name is missing.
update orders as o
set
  agency_name = a.name
from agencies as a
where
  o.agency_id = a.id
  and o.agency_name is null;
