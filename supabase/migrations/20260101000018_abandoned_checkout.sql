-- Abandoned checkout tracking
ALTER TABLE orders ADD COLUMN abandoned_reminder_sent_at TIMESTAMPTZ;

-- Extend order expiry window from 15 min to 60 min so reminder can fire at 30 min
ALTER TABLE orders ALTER COLUMN expires_at SET DEFAULT now() + interval '60 minutes';

-- pg_cron: every 5 min, flag abandoned checkouts for reminder emails
-- Targets orders that are awaiting_payment, created 28-60 min ago, not yet reminded, not expired
SELECT cron.schedule(
  'flag-abandoned-checkouts',
  '*/5 * * * *',
  $$
  UPDATE orders
  SET abandoned_reminder_sent_at = now()
  WHERE status = 'awaiting_payment'
    AND created_at < now() - interval '28 minutes'
    AND created_at > now() - interval '60 minutes'
    AND abandoned_reminder_sent_at IS NULL
    AND expires_at > now();
  $$
);
