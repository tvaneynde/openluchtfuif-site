-- Section visibility + mode (live | coming_soon)
CREATE TABLE page_sections (
  id       TEXT PRIMARY KEY,
  label    TEXT NOT NULL,
  visible  BOOLEAN NOT NULL DEFAULT TRUE,
  mode     TEXT    NOT NULL DEFAULT 'live' CHECK (mode IN ('live', 'coming_soon')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lineup artists
CREATE TABLE lineup_artists (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  genre      TEXT NOT NULL DEFAULT 'DJ Set',
  time_slot  TEXT,
  headliner  BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partners / sponsors
CREATE TABLE partners (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  logo_path   TEXT,
  website_url TEXT,
  featured    BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Seed ──────────────────────────────────────────────────────────────────────

INSERT INTO page_sections (id, label, visible, mode) VALUES
  ('lineup',   'Line-up',  TRUE, 'coming_soon'),
  ('tickets',  'Tickets',  TRUE, 'live'),
  ('partners', 'Partners', TRUE, 'live'),
  ('info',     'Info',     TRUE, 'coming_soon'),
  ('faq',      'FAQ',      TRUE, 'coming_soon');

INSERT INTO lineup_artists (name, genre, time_slot, sort_order) VALUES
  ('Thurbo',                'DJ Set', '20:00 – 21:00', 1),
  ('P-Mountain Collective', 'DJ Set', '21:00 – 22:00', 2),
  ('Karakals',              'DJ Set', '22:00 – 23:00', 3),
  ('Partyshakerz',          'DJ Set', '23:00 – 00:00', 4),
  ('Pitte & Runkel',        'DJ Set', '00:00 – 01:00', 5),
  ('Kleinefrigo',           'DJ Set', '01:00 – 02:00', 6),
  ('D-Nill',                'DJ Set', '02:00 – 03:00', 7);

INSERT INTO partners (name, logo_path, featured, sort_order) VALUES
  ('Baets',           'partners/baets.jpg',            TRUE,  1),
  ('Huurland',        'partners/huurland.png',         TRUE,  2),
  ('Pasteels',        'partners/pasteels.png',         TRUE,  3),
  ('Spar Linden',     'partners/sparlinden.jpg',       FALSE, 4),
  ('Vlaams-Brabant',  'partners/vlaamsbrabant.jpg.jpg',FALSE, 5),
  ('Immodrome',       'partners/immodrome.png',        FALSE, 6),
  ('Philippe Spaas',  'partners/philippespaas.png',    FALSE, 7),
  ('Bits & Baets',    'partners/bitsnbaets.png',       FALSE, 8),
  ('Lopharma',        'partners/lopharma.png',         FALSE, 9),
  ('De Raaf',         'partners/deraaf.png',           FALSE, 10),
  ('Sempels',         'partners/sempels.svg',          FALSE, 11),
  ('RGT Cars',        'partners/rgtcars.png',          FALSE, 12),
  ('Shaved Monkey',   'partners/shavedmonkey.png',     FALSE, 13),
  ('An Wouters',      'partners/anwouters.png',        FALSE, 14),
  ('Louis Schreve',   'partners/louisschrevebs.png',   FALSE, 15),
  ('Buurt 3212',      'partners/buurt3212.jpeg',       FALSE, 16),
  ('Uw Notaris',      'partners/uwnotaris.jpg',        FALSE, 17);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE page_sections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineup_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read page_sections"  ON page_sections  FOR SELECT USING (TRUE);
CREATE POLICY "Public read lineup_artists" ON lineup_artists FOR SELECT USING (TRUE);
CREATE POLICY "Public read partners"       ON partners       FOR SELECT USING (TRUE);

CREATE POLICY "Auth manage page_sections"  ON page_sections  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth manage lineup_artists" ON lineup_artists FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth manage partners"       ON partners       FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ── Grants ────────────────────────────────────────────────────────────────────

GRANT SELECT ON page_sections, lineup_artists, partners TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON page_sections, lineup_artists, partners TO authenticated;
