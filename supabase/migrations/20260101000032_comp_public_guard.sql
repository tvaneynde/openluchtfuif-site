-- ============================================================
-- Close the public door before comp tiers exist.
--
-- Comp tiers are created with is_active = false, but that is NOT a security
-- boundary: TierManagement.jsx has a one-click ACTIEF toggle sitting right next
-- to every tier card, so a single misclick would publish a €0 tier on the
-- checkout page. Make is_comp the boundary instead, enforced in RLS.
--
-- Authenticated staff keep full access through their own FOR ALL policy
-- (migration 000009), so the dashboard still sees comp tiers.
-- ============================================================

DROP POLICY IF EXISTS "Public read active tiers" ON ticket_tiers;

CREATE POLICY "Public read active tiers"
  ON ticket_tiers FOR SELECT
  TO anon
  USING (is_active = true AND is_comp = false);

-- A 100%-percent promo code combined with the free-order branch in
-- create-payment was a second way to mint free tickets — from the public,
-- unauthenticated endpoint. That branch is being removed in the same change;
-- retire the codes that could exploit it so the two fixes can't drift apart.
-- Free tickets now have exactly one path: issue_comp_tickets(), admin-only.
UPDATE promo_codes
SET is_active = false
WHERE discount_type = 'percent' AND discount_value >= 100;

-- Only drop the seed row if no order ever referenced it (promo_code is an FK).
DELETE FROM promo_codes
WHERE code = 'PERS2026'
  AND NOT EXISTS (SELECT 1 FROM orders WHERE orders.promo_code = promo_codes.code);
