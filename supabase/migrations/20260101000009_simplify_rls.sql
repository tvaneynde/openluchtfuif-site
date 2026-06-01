-- ============================================================
-- Simplify RLS: any authenticated user = admin
-- Rationale: ticket buyers never get Supabase auth accounts,
-- so auth.uid() IS NOT NULL reliably means "is staff/admin".
-- This avoids JWT claim caching issues entirely.
-- ============================================================

-- Drop old admin-check policies
DROP POLICY IF EXISTS "Admin full access tiers"    ON ticket_tiers;
DROP POLICY IF EXISTS "Admin read all orders"      ON orders;
DROP POLICY IF EXISTS "Admin update orders"        ON orders;
DROP POLICY IF EXISTS "Admin read all tickets"     ON tickets;
DROP POLICY IF EXISTS "Admin read scan events"     ON scan_events;
DROP POLICY IF EXISTS "Admin read email log"       ON email_log;
DROP POLICY IF EXISTS "Admin update email log"     ON email_log;
DROP POLICY IF EXISTS "Admin read config"          ON config;
DROP POLICY IF EXISTS "Admin write config"         ON config;
DROP POLICY IF EXISTS "Admin manage admin_users"   ON admin_users;

-- ---- ticket_tiers ----
-- Any authenticated user: full CRUD (admin dashboard)
-- Anon: can read active tiers only (checkout page)
CREATE POLICY "Authenticated full access tiers"
  ON ticket_tiers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---- orders ----
CREATE POLICY "Authenticated full access orders"
  ON orders FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---- tickets ----
CREATE POLICY "Authenticated full access tickets"
  ON tickets FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---- scan_events ----
CREATE POLICY "Authenticated full access scan_events"
  ON scan_events FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---- email_log ----
CREATE POLICY "Authenticated full access email_log"
  ON email_log FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---- config ----
CREATE POLICY "Authenticated full access config"
  ON config FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---- admin_users ----
CREATE POLICY "Authenticated full access admin_users"
  ON admin_users FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
