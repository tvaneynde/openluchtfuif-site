-- ============================================================
-- Comp ("gratis") tickets — schema only, no behaviour change yet.
--
-- Sponsors and a partner organisation (ticket-swap deal) get free tickets.
-- Those are real, scannable tickets, but they must never pollute sales
-- figures or shrink the public availability meters. Two new concepts:
--
--   ticket_tiers.is_comp  — a tier that is given away, never sold. Its
--                           total_capacity is the negotiated allotment and
--                           its sold_count is "comps issued", so comps never
--                           touch the inventory of any purchasable tier.
--   orders.order_type     — 'sale' | 'comp'. Every revenue/sales aggregation
--                           filters on 'sale'; the gate and headcount paths
--                           deliberately do not.
--
-- Nothing here creates a comp tier or a comp order — the read-path guards
-- (0032, 0033, 0034 + the dashboard) must land first.
-- ============================================================

ALTER TABLE ticket_tiers ADD COLUMN is_comp BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE orders
  ADD COLUMN order_type  TEXT NOT NULL DEFAULT 'sale'
             CHECK (order_type IN ('sale', 'comp')),
  ADD COLUMN comp_reason TEXT,
  ADD COLUMN comp_note   TEXT;

ALTER TABLE orders
  ADD CONSTRAINT orders_comp_reason_values_check
  CHECK (comp_reason IS NULL OR comp_reason IN ('sponsor', 'partner_swap', 'crew', 'other'));

-- A comp order must say why it was given away; a sale must not pretend to be one.
ALTER TABLE orders
  ADD CONSTRAINT orders_comp_reason_check
  CHECK (
    (order_type = 'sale' AND comp_reason IS NULL)
    OR
    (order_type = 'comp' AND comp_reason IS NOT NULL)
  );

-- The original inline check (migration 000001) capped quantity at 10, which is
-- right for a public checkout but wrong for a 40-ticket sponsor batch. Comps are
-- capped inside issue_comp_tickets() instead; the public path is still capped at
-- 10 in create-payment/index.ts.
-- The original was an inline (unnamed) CHECK, so its generated name is an
-- assumption. Drop whatever CHECK constraint actually references quantity rather
-- than trusting the name: silently failing to drop it would cap sponsor batches
-- at 10 with a constraint error nobody would connect to this migration.
DO $$
DECLARE
  v_name TEXT;
BEGIN
  FOR v_name IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.orders'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%quantity%'
  LOOP
    EXECUTE format('ALTER TABLE orders DROP CONSTRAINT %I', v_name);
    RAISE NOTICE 'Dropped quantity constraint: %', v_name;
  END LOOP;
END $$;

ALTER TABLE orders
  ADD CONSTRAINT orders_quantity_check
  CHECK (quantity >= 1 AND (order_type = 'comp' OR quantity <= 10));

-- Covering index for every dashboard aggregation, which all become
-- status = 'paid' AND order_type = 'sale' ORDER BY paid_at DESC.
CREATE INDEX idx_orders_sale ON orders (status, paid_at DESC) WHERE order_type = 'sale';

-- Physical venue capacity is NOT the sum of tier capacities: adding a comp tier
-- would otherwise silently raise "capacity" while the field still holds the same
-- number of people. Keep it as an explicit, admin-only number.
INSERT INTO config (key, value)
VALUES ('venue_capacity', '500'::jsonb)
ON CONFLICT (key) DO NOTHING;
