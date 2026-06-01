-- ============================================================
-- Migration: Seed data — test tier + admin user + config
-- ============================================================

-- HMAC secret for scan token generation (CHANGE THIS before launch)
INSERT INTO config (key, value) VALUES
  ('hmac_secret', '"change-this-to-a-random-64-char-secret-before-going-live"'),
  ('event_name',  '"Openluchtfuif 3212"'),
  ('event_date',  '"2026-08-29"'),
  ('scanner_pin', '"1234"')
ON CONFLICT (key) DO NOTHING;

-- Admin user (add your email here)
INSERT INTO admin_users (email) VALUES
  ('tomasvaneynde@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- Test ticket tier: Vroegvogel
INSERT INTO ticket_tiers (
  name, description, price_cents, fee_cents,
  total_capacity, is_active, sort_order
) VALUES (
  'Vroegvogel',
  'De goedkoopste manier om erbij te zijn. Beperkt aantal beschikbaar.',
  1200,   -- €12.00
  50,     -- €0.50 fee to cover Mollie costs
  100,
  true,
  1
) ON CONFLICT DO NOTHING;
