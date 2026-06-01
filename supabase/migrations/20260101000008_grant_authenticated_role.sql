-- Grant authenticated role access to all tables
-- RLS policies still control which rows are visible per user
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Anon only needs to read active ticket tiers (for the checkout page)
GRANT SELECT ON ticket_tiers TO anon;
