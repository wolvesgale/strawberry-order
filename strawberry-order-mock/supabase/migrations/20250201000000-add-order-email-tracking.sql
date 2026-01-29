ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_message_id text;

UPDATE orders
SET status = 'sent'
WHERE status = 'shipped';
