-- pg_cron: every 5 min, call the send-abandoned-reminders edge function
-- This runs 1 minute offset from the flagging job so orders are already flagged
SELECT cron.schedule(
  'send-abandoned-reminders',
  '1-59/5 * * * *',
  format(
    $$
    SELECT net.http_post(
      url := %L,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
    $$,
    current_setting('app.supabase_url') || '/functions/v1/send-abandoned-reminders'
  )
);
