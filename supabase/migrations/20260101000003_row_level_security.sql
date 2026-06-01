-- ============================================================
-- Migration: Row Level Security policies
-- ============================================================

-- Helper: check if the current user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE email = auth.jwt() ->> 'email'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---- ticket_tiers ----
ALTER TABLE ticket_tiers ENABLE ROW LEVEL SECURITY;

-- Anyone can read active tiers (needed for checkout page)
CREATE POLICY "Public read active tiers"
  ON ticket_tiers FOR SELECT
  USING (is_active = true);

-- Admins have full access
CREATE POLICY "Admin full access tiers"
  ON ticket_tiers FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ---- orders ----
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- No public read — all order operations go through Edge Functions (service role)
-- Admins can read all
CREATE POLICY "Admin read all orders"
  ON orders FOR SELECT
  USING (is_admin());

CREATE POLICY "Admin update orders"
  ON orders FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- ---- tickets ----
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- No public access — scanner uses Edge Function with service role
CREATE POLICY "Admin read all tickets"
  ON tickets FOR SELECT
  USING (is_admin());

-- ---- scan_events ----
ALTER TABLE scan_events ENABLE ROW LEVEL SECURITY;

-- Append-only from scanner Edge Function (service role)
-- Admins can read
CREATE POLICY "Admin read scan events"
  ON scan_events FOR SELECT
  USING (is_admin());

-- ---- email_log ----
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read email log"
  ON email_log FOR SELECT
  USING (is_admin());

CREATE POLICY "Admin update email log"
  ON email_log FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- ---- config ----
ALTER TABLE config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read config"
  ON config FOR SELECT
  USING (is_admin());

CREATE POLICY "Admin write config"
  ON config FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ---- admin_users ----
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Admins can manage the admin list
CREATE POLICY "Admin manage admin_users"
  ON admin_users FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());
