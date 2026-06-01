-- Enable pg_cron (available on Supabase Pro; on free tier this is a no-op)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Run expire_old_orders() every 5 minutes
SELECT cron.schedule(
  'expire-old-orders',         -- job name (unique)
  '*/5 * * * *',               -- every 5 minutes
  $$SELECT expire_old_orders()$$
);
