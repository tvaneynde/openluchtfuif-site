-- SECURITY FIX: config and tickets were both fully readable by the anon role
-- (qual = true, no filter), exposing:
--   - config.scanner_pin  — the door-scanner PIN, in plaintext
--   - config.hmac_secret  — the server secret used to derive every ticket's
--                           scan_token (the QR-code entry secret)
--   - tickets.scan_token  — the QR-code secret itself, for every ticket
-- All three were confirmed readable via the public REST API with just the
-- anon key (bundled in the JS build), no login required.
--
-- Fix:
--   1. Rotate both secrets (all 11 existing tickets are the site owner's own
--      test purchases, not real customers, so recomputing their scan_token
--      under the new hmac_secret is safe — no real customer QR codes exist yet).
--   2. Restrict anon SELECT on config to the two genuinely public keys.
--   3. Drop anon SELECT on tickets entirely — the scanner app now fetches its
--      offline cache through the scanner-cache edge function (PIN-authenticated,
--      service-role access), not direct table access.
--   4. Add a safe, secret-free RPC for the scanner's live gate-count display.

UPDATE config SET value = '"053815220947bb593e07bea6d13ffb961ae039a39a94b714dfead657cd4ec4cc"'::jsonb, updated_at = now()
WHERE key = 'hmac_secret';

-- The scanner PIN screen is a 4-digit numpad UI, so this stays 4 digits.
UPDATE config SET value = '"8589"'::jsonb, updated_at = now()
WHERE key = 'scanner_pin';

-- Recompute scan_token for every existing ticket so they remain valid under
-- the new hmac_secret (safe: all current tickets are test purchases).
UPDATE tickets
SET scan_token = encode(
  extensions.hmac(
    tickets.id::text || tickets.order_id::text,
    (SELECT value::text FROM config WHERE key = 'hmac_secret'),
    'sha256'
  ),
  'hex'
);

DROP POLICY IF EXISTS "Public can read config" ON config;
CREATE POLICY "Public can read public config keys" ON config
  FOR SELECT TO anon
  USING (key IN ('event_name', 'event_date'));

DROP POLICY IF EXISTS "Public can read tickets" ON tickets;

CREATE OR REPLACE FUNCTION get_scan_stats()
RETURNS TABLE (scanned_today integer, total_issued integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*)::int FROM scan_events WHERE result = 'valid' AND scanned_at >= current_date),
    (SELECT count(*)::int FROM scan_events WHERE result = 'valid' AND scanned_at >= current_date)
      + (SELECT count(*)::int FROM tickets WHERE status = 'valid');
$$;

GRANT EXECUTE ON FUNCTION get_scan_stats() TO anon, authenticated;
