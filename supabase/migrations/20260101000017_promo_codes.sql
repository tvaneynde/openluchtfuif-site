-- ── Promo codes ──────────────────────────────────────────────────────────────
CREATE TABLE promo_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT UNIQUE NOT NULL,           -- e.g. "PERS2026", "VRIJWILLIGERS"
  description   TEXT,
  discount_type TEXT NOT NULL
                CHECK (discount_type IN ('percent', 'fixed')),
  discount_value INTEGER NOT NULL CHECK (discount_value > 0),
                -- percent: 0-100, fixed: cents (e.g. 500 = €5)
  max_uses      INTEGER,                        -- NULL = unlimited
  used_count    INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  valid_until   TIMESTAMPTZ,                    -- NULL = no expiry
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allow anon to read active codes (needed to validate at checkout)
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read active promo codes"
  ON promo_codes FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Authenticated full access promo_codes"
  ON promo_codes FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT ON public.promo_codes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_codes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_codes TO service_role;

-- Add promo fields to orders
ALTER TABLE orders
  ADD COLUMN promo_code TEXT REFERENCES promo_codes(code),
  ADD COLUMN discount_cents INTEGER NOT NULL DEFAULT 0;

-- Seed: example codes
INSERT INTO promo_codes (code, description, discount_type, discount_value, is_active)
VALUES
  ('PERS2026',       'Pers - gratis ticket',      'percent', 100, false),
  ('VRIJWILLIGER',   'Vrijwilliger - €5 korting',  'fixed',   500, false),
  ('SPONSOR10',      'Sponsor - 10% korting',      'percent',  10, false);
