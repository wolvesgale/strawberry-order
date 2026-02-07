-- Backfill agency snapshot on orders using profile email mapping.
-- Run once in Supabase SQL editor or migration runner.
UPDATE orders AS o
SET
  agency_id = COALESCE(o.agency_id, p.agency_id),
  agency_name = COALESCE(o.agency_name, a.name, p.agency_name)
FROM profiles AS p
LEFT JOIN agencies AS a ON a.id = p.agency_id
WHERE o.created_by_email = p.email
  AND (o.agency_id IS NULL OR o.agency_name IS NULL);
