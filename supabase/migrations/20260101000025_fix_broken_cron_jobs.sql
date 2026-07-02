-- Two cron jobs were silently failing on every run (confirmed via
-- cron.job_run_details):
--
-- 1. process-email-queue: used current_setting('app.supabase_url') /
--    'app.service_role_key', neither of which is a real Postgres GUC —
--    every run errored with "unrecognized configuration parameter".
--    This is the safety-net retry for ticket confirmation emails when the
--    webhook's direct fetch fails/times out; it has never fired.
--
-- 2. abandoned-checkout-reminders: used `RETURNING id INTO _ignored` on a
--    bare UPDATE, which is only valid inside a PL/pgSQL block, not in a
--    raw SQL string passed to cron.schedule — every run errored with a
--    syntax error. No order has ever been flagged for an abandoned-cart
--    reminder as a result.
--
-- Fix: store the service role key in Supabase Vault (never in a
-- git-tracked migration file) and read it back at cron-run time via
-- vault.decrypted_secrets. Drop the invalid RETURNING clause.

-- The real secret value is seeded separately via `vault.create_secret(...)`
-- run directly against production (never committed to git). This only
-- ensures a row exists for `db reset`/local dev via the vault API (never
-- insert directly into vault.secrets — the value must go through
-- vault.create_secret to be encrypted correctly).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'service_role_key') THEN
    PERFORM vault.create_secret('REPLACE_ME_LOCAL_DEV_ONLY', 'service_role_key');
  END IF;
END $$;

SELECT cron.unschedule('process-email-queue');
SELECT cron.schedule(
  'process-email-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://noihnuouftyvsvzybwer.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'
      )
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

SELECT cron.unschedule('abandoned-checkout-reminders');
SELECT cron.schedule(
  'abandoned-checkout-reminders',
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
