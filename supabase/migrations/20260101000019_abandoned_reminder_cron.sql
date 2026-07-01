-- pg_cron: every 5 min, call the send-abandoned-reminders edge function
SELECT cron.schedule(
  'send-abandoned-reminders',
  '1-59/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://noihnuouftyvsvzybwer.supabase.co/functions/v1/send-abandoned-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
