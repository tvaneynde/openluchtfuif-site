-- ============================================================
-- Free tickets: no allotment, one tier, reason does the work.
--
-- The negotiated-quota model was wrong for how this is actually used: there is
-- no cap on what we can give away, and per-deal tiers meant a schema change
-- every time a new deal appeared. Collapse to a single unlimited comp tier and
-- let orders.comp_reason (sponsor / partner_swap / crew / other) carry the
-- distinction — it already does, and it's per-order rather than per-tier.
--
-- Unchanged: comps still book against a tier that no purchasable path can see,
-- so sales figures and public availability are still untouched, and comps still
-- count toward expected headcount.
-- ============================================================

DO $$
DECLARE
  v_new_tier UUID;
BEGIN
  -- 999999 rather than a nullable capacity: total_capacity is NOT NULL with a
  -- CHECK (> 0), and this is the same "not tracked" convention Deurverkoop uses.
  INSERT INTO ticket_tiers (
    name, description, price_cents, fee_cents,
    total_capacity, is_active, is_door_sale, is_comp, sort_order
  ) VALUES (
    'Gratis ticket',
    'Weggegeven aan sponsors, partners en crew — geen limiet.',
    0, 0, 999999, false, false, true, 100
  )
  RETURNING id INTO v_new_tier;

  -- Move anything already issued against the old per-deal tiers, so their
  -- sold_count (and therefore the headcount) survives the switch.
  UPDATE tickets t
  SET tier_id = v_new_tier
  WHERE t.tier_id IN (
    SELECT id FROM ticket_tiers WHERE is_comp AND id <> v_new_tier
  );

  UPDATE orders o
  SET tier_id = v_new_tier
  WHERE o.tier_id IN (
    SELECT id FROM ticket_tiers WHERE is_comp AND id <> v_new_tier
  );

  UPDATE ticket_tiers
  SET sold_count = (
    SELECT COALESCE(sum(quantity), 0) FROM orders
    WHERE tier_id = v_new_tier AND order_type = 'comp' AND status = 'paid'
  )
  WHERE id = v_new_tier;

  DELETE FROM ticket_tiers WHERE is_comp AND id <> v_new_tier;
END $$;

-- ---- issue_comp_tickets: no tier argument, no caps ----
-- The tier is resolved internally now (there is exactly one), so the caller
-- only supplies who, how many and why.
DROP FUNCTION IF EXISTS issue_comp_tickets(UUID, TEXT, TEXT, INTEGER, TEXT, TEXT, BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION issue_comp_tickets(
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
  v_tier_id   UUID;
  v_order_id  UUID;
  v_key       TEXT;
  v_existing  UUID;
  v_email     TEXT := lower(trim(p_email));
  v_name      TEXT := trim(p_recipient_name);
BEGIN
  IF v_name IS NULL OR v_name = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'name_required');
  END IF;

  IF v_email IS NULL OR v_email !~* '^[^@]+@[^@]+\.[^@]+$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_email');
  END IF;

  -- Not a policy cap — there is none. This is a fat-finger guard so a stray
  -- keystroke can't mint five thousand tickets in one click.
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 500 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_quantity');
  END IF;

  IF p_reason IS NULL OR p_reason NOT IN ('sponsor', 'partner_swap', 'crew', 'other') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_reason');
  END IF;

  -- Idempotency: a double-clicked button must not issue twice. Prefixed so a
  -- comp key can never collide with create-payment's SHA-256 hex keys.
  v_key := 'comp:' || COALESCE(NULLIF(trim(p_idempotency_key), ''), gen_random_uuid()::text);

  SELECT id INTO v_existing FROM orders WHERE mollie_idempotency_key = v_key;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true, 'order_id', v_existing);
  END IF;

  SELECT id INTO v_tier_id FROM ticket_tiers WHERE is_comp ORDER BY sort_order LIMIT 1 FOR UPDATE;
  IF v_tier_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_comp_tier');
  END IF;

  -- Inserted directly as 'paid': a row briefly left at 'pending' could be swept
  -- to 'expired' by expire_old_orders().
  INSERT INTO orders (
    tier_id, quantity, total_cents, buyer_email, buyer_name,
    status, paid_at, order_type, comp_reason, comp_note, mollie_idempotency_key
  ) VALUES (
    v_tier_id, p_quantity, 0, v_email, v_name,
    'paid', now(), 'comp', p_reason, NULLIF(trim(p_note), ''), v_key
  )
  RETURNING id INTO v_order_id;

  -- sold_count on a comp tier means "given away", and it's what feeds expected
  -- headcount. It is never compared against total_capacity.
  UPDATE ticket_tiers
  SET sold_count = sold_count + p_quantity,
      updated_at = now()
  WHERE id = v_tier_id;

  PERFORM mint_tickets(v_order_id, v_tier_id, p_quantity);

  IF p_send_email THEN
    INSERT INTO email_log (order_id, type, status)
    VALUES (v_order_id, 'ticket_confirmation', 'pending');
  END IF;

  RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'tickets_issued', p_quantity);

EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO v_existing FROM orders WHERE mollie_idempotency_key = v_key;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'already_processed', true, 'order_id', v_existing);
    END IF;
    RAISE;
END;
$$;

REVOKE EXECUTE ON FUNCTION issue_comp_tickets(TEXT, TEXT, INTEGER, TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION issue_comp_tickets(TEXT, TEXT, INTEGER, TEXT, TEXT, BOOLEAN, TEXT) TO authenticated, service_role;
