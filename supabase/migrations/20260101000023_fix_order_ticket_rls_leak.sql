-- SECURITY FIX: "Anyone can read order by id" and "Public can read tickets" had
-- qual = true with no row filter, meaning any client holding the public anon key
-- could SELECT * from orders/tickets with no WHERE clause and dump every buyer's
-- name/email/amount, and every ticket's scan_token (the QR-code secret used for
-- door entry). Both were exploitable via the public REST API with no order_id
-- or session needed. Replace the orders lookup with a SECURITY DEFINER RPC that
-- only returns a single row for a known id, and drop the blanket policy.

DROP POLICY IF EXISTS "Anyone can read order by id" ON orders;

CREATE OR REPLACE FUNCTION get_order_status(p_order_id uuid)
RETURNS TABLE (
  id                 uuid,
  status             text,
  buyer_name         text,
  buyer_email        text,
  total_cents        integer,
  quantity           integer,
  mollie_payment_id  text,
  tier_id            uuid,
  tier_name          text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.status, o.buyer_name, o.buyer_email, o.total_cents, o.quantity,
         o.mollie_payment_id, t.id, t.name
  FROM orders o
  JOIN ticket_tiers t ON t.id = o.tier_id
  WHERE o.id = p_order_id;
$$;

GRANT EXECUTE ON FUNCTION get_order_status(uuid) TO anon, authenticated;
