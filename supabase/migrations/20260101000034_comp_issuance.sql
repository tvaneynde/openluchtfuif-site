-- ============================================================
-- Comp ticket issuance & revocation.
--
-- issue_comp_tickets() is the ONLY way a free ticket can come into existence.
-- It is admin-only (granted to authenticated + service_role, explicitly revoked
-- from anon and PUBLIC) and it books against the comp tier's own allotment, so
-- no purchasable tier's inventory ever moves.
--
-- Lock ordering is order-then-tier everywhere in this schema (see
-- confirm_payment), so these functions cannot deadlock against a concurrent
-- Mollie webhook.
-- ============================================================

CREATE OR REPLACE FUNCTION issue_comp_tickets(
  p_tier_id         UUID,
  p_recipient_name  TEXT,
  p_email           TEXT,
  p_quantity        INTEGER,
  p_reason          TEXT,
  p_note            TEXT DEFAULT NULL,
  p_send_email      BOOLEAN DEFAULT true,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_tier      ticket_tiers%ROWTYPE;
  v_order_id  UUID;
  v_key       TEXT;
  v_existing  UUID;
  v_venue_cap INTEGER;
  v_headcount INTEGER;
  v_email     TEXT := lower(trim(p_email));
  v_name      TEXT := trim(p_recipient_name);
BEGIN
  -- ---- Input validation (mirrors the table constraints, with clean errors) ----
  IF v_name IS NULL OR v_name = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'name_required');
  END IF;

  IF v_email IS NULL OR v_email !~* '^[^@]+@[^@]+\.[^@]+$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_email');
  END IF;

  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_quantity');
  END IF;

  IF p_reason IS NULL OR p_reason NOT IN ('sponsor', 'partner_swap', 'crew', 'other') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_reason');
  END IF;

  -- ---- Idempotency: a double-clicked button must not issue twice ----
  -- Prefixed so a comp key can never collide with the SHA-256 hex keys that
  -- create-payment generates.
  v_key := 'comp:' || COALESCE(NULLIF(trim(p_idempotency_key), ''), gen_random_uuid()::text);

  SELECT id INTO v_existing FROM orders WHERE mollie_idempotency_key = v_key;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true, 'already_processed', true, 'order_id', v_existing
    );
  END IF;

  -- ---- Allotment check, under lock ----
  SELECT * INTO v_tier FROM ticket_tiers WHERE id = p_tier_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'tier_not_found');
  END IF;

  IF NOT v_tier.is_comp THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_a_comp_tier');
  END IF;

  IF (v_tier.sold_count + p_quantity) > v_tier.total_capacity THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'allotment_exceeded',
      'remaining', v_tier.total_capacity - v_tier.sold_count
    );
  END IF;

  -- ---- Physical venue check ----
  -- Comps are real bodies on a field of finite size, so they count toward the
  -- same headcount as sales. Skipped if venue_capacity isn't configured.
  SELECT (value #>> '{}')::int INTO v_venue_cap FROM config WHERE key = 'venue_capacity';
  IF v_venue_cap IS NOT NULL THEN
    SELECT COALESCE(sum(sold_count), 0) INTO v_headcount
    FROM ticket_tiers WHERE is_door_sale = false;

    IF (v_headcount + p_quantity) > v_venue_cap THEN
      RETURN jsonb_build_object(
        'success', false, 'error', 'venue_capacity_exceeded',
        'headcount', v_headcount, 'venue_capacity', v_venue_cap
      );
    END IF;
  END IF;

  -- ---- Create the comp order, already paid, in one statement ----
  -- Inserted directly as 'paid' rather than insert-then-confirm: a row briefly
  -- left at 'pending' could be swept to 'expired' by expire_old_orders().
  INSERT INTO orders (
    tier_id, quantity, total_cents, buyer_email, buyer_name,
    status, paid_at, order_type, comp_reason, comp_note, mollie_idempotency_key
  ) VALUES (
    p_tier_id, p_quantity, 0, v_email, v_name,
    'paid', now(), 'comp', p_reason, NULLIF(trim(p_note), ''), v_key
  )
  RETURNING id INTO v_order_id;

  UPDATE ticket_tiers
  SET sold_count = sold_count + p_quantity,
      updated_at = now()
  WHERE id = p_tier_id;

  PERFORM mint_tickets(v_order_id, p_tier_id, p_quantity);

  -- Same payload as confirm_payment, so the existing Resend queue picks it up
  -- with no changes. Skipped when the organiser wants to hand the PDF over.
  IF p_send_email THEN
    INSERT INTO email_log (order_id, type, status)
    VALUES (v_order_id, 'ticket_confirmation', 'pending');
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'order_id', v_order_id, 'tickets_issued', p_quantity
  );

EXCEPTION
  -- Two concurrent calls with the same key: the loser reports the winner's order.
  WHEN unique_violation THEN
    SELECT id INTO v_existing FROM orders WHERE mollie_idempotency_key = v_key;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true, 'already_processed', true, 'order_id', v_existing
      );
    END IF;
    RAISE;
END;
$$;

-- ---- revoke_comp_order ----
-- Gives the allotment back, which the paid-refund path in OrdersTable.jsx
-- currently does NOT do (tracked separately). Terminal status is 'refunded',
-- not 'cancelled': create-payment recycles cancelled/expired rows by
-- idempotency key, and a comp row must never be adopted by a Mollie sale.
CREATE OR REPLACE FUNCTION revoke_comp_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_order    orders%ROWTYPE;
  v_scanned  INTEGER;
  v_revoked  INTEGER;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'order_not_found');
  END IF;

  IF v_order.order_type <> 'comp' THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_a_comp_order');
  END IF;

  IF v_order.status <> 'paid' THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true);
  END IF;

  -- Someone already walked in on this ticket; revoking would corrupt headcount.
  SELECT count(*) INTO v_scanned
  FROM tickets WHERE order_id = p_order_id AND status = 'scanned';

  IF v_scanned > 0 THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'already_scanned', 'scanned', v_scanned
    );
  END IF;

  -- Lock the tier only after the order (see lock-ordering note above)
  PERFORM 1 FROM ticket_tiers WHERE id = v_order.tier_id FOR UPDATE;

  UPDATE tickets
  SET status = 'cancelled'
  WHERE order_id = p_order_id AND status = 'valid';
  GET DIAGNOSTICS v_revoked = ROW_COUNT;

  UPDATE ticket_tiers
  SET sold_count = GREATEST(0, sold_count - v_revoked),
      updated_at = now()
  WHERE id = v_order.tier_id;

  UPDATE orders
  SET status = 'refunded', updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'tickets_revoked', v_revoked);
END;
$$;

-- Postgres grants EXECUTE to PUBLIC on new functions by default — revoke first.
REVOKE EXECUTE ON FUNCTION issue_comp_tickets(UUID, TEXT, TEXT, INTEGER, TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION revoke_comp_order(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION issue_comp_tickets(UUID, TEXT, TEXT, INTEGER, TEXT, TEXT, BOOLEAN, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION revoke_comp_order(UUID) TO authenticated, service_role;

-- ---- Comp tiers ----
-- Created here, not from TierManagement.jsx: its form has no is_comp field, and
-- these rows must never be flipped active. total_capacity is the negotiated
-- allotment and acts as the hard cap in issue_comp_tickets().
INSERT INTO ticket_tiers (
  name, description, price_cents, fee_cents,
  total_capacity, is_active, is_door_sale, is_comp, sort_order
) VALUES
  ('Sponsorticket', 'Gratis tickets voor sponsors.',                    0, 0, 40, false, false, true, 100),
  ('Partnerruil',   'Gratis tickets in ruil voor tickets van partner.', 0, 0, 40, false, false, true, 101);
