-- Allow public read of non-sensitive config keys (needed for scanner PIN check)
CREATE POLICY "Public can read config"
  ON config FOR SELECT
  TO anon
  USING (true);

-- Allow public read of tickets (scanner caches valid tokens on load)
CREATE POLICY "Public can read tickets"
  ON tickets FOR SELECT
  TO anon
  USING (true);
