-- ============================================================
-- Fix is_admin() to check app_metadata JWT claim
-- This eliminates the circular RLS dependency on admin_users
-- ============================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Update admin_users with the correct email
TRUNCATE admin_users;
INSERT INTO admin_users (email) VALUES ('tomas@vaneynde.eu')
ON CONFLICT (email) DO NOTHING;
