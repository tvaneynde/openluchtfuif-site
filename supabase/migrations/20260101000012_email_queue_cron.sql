-- Email queue retry worker via pg_cron + pg_net
-- Runs every minute as a safety net for failed/missed email deliveries.
-- Primary delivery happens immediately in mollie-webhook; this catches retries.

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the email queue processor every minute
SELECT cron.schedule(
  'process-email-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body    := '{}'::jsonb
  )
  WHERE EXISTS (
    SELECT 1 FROM email_log
    WHERE status = 'pending' AND attempts < 5
    LIMIT 1
  );
  $$
);
