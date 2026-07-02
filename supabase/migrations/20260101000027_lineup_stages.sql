-- Two stages this edition (Main + Dub) instead of one. Also add fields needed
-- for the artist detail view (photo, bio) since the lineup section previously
-- only showed a flat list of names with no way to click through for more info.

ALTER TABLE lineup_artists
  ADD COLUMN stage TEXT NOT NULL DEFAULT 'main' CHECK (stage IN ('main', 'dub')),
  ADD COLUMN photo_path TEXT,
  ADD COLUMN bio TEXT;
