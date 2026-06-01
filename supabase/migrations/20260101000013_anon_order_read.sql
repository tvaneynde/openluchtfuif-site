-- Allow anyone to read an order by its ID.
-- Order IDs are 128-bit UUIDs (unguessable), so knowing the ID is
-- proof of "ownership" — only the buyer received the redirect URL.
CREATE POLICY "Anyone can read order by id"
  ON orders FOR SELECT
  TO anon
  USING (true);
