-- ============================================================
-- Extract the ticket-minting loop out of confirm_payment().
--
-- Pure refactor — no behaviour change. Comp issuance needs to mint tickets the
-- exact same way a sale does, and a second copy of the HMAC expression is the
-- one bug that would produce tickets that don't scan at the gate. One
-- definition, used by both paths.
--
-- Two things that must stay byte-for-byte identical to migration 000004/000024:
--   * value::text on a jsonb column yields the string WITH its surrounding
--     quotes. Every existing scan_token was computed that way, so "cleaning
--     that up" would invalidate every ticket already in the wild.
--   * hmac() lives in the extensions schema on hosted Supabase, hence the
--     explicit search_path.
--
-- The COALESCE fallback to 'fallback-change-this-in-production' is dropped on
-- purpose: silently minting tokens under a publicly known secret is far worse
-- than failing loudly.
-- ============================================================

CREATE OR REPLACE FUNCTION mint_tickets(
  p_order_id UUID,
  p_tier_id  UUID,
  p_quantity INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_secret      TEXT;
  v_ticket_id   UUID;
  v_scan_token  TEXT;
  v_ticket_num  TEXT;
  v_i           INTEGER;
BEGIN
  SELECT value::text INTO v_secret FROM config WHERE key = 'hmac_secret';
  IF v_secret IS NULL OR length(v_secret) < 16 THEN
    RAISE EXCEPTION 'hmac_secret is missing or too short — refusing to mint tickets';
  END IF;

  FOR v_i IN 1..p_quantity LOOP
    v_ticket_id  := gen_random_uuid();
    -- scan_token: HMAC of (ticket_id + order_id) under the server secret
    v_scan_token := encode(hmac(v_ticket_id::text || p_order_id::text, v_secret, 'sha256'), 'hex');
    -- Human-readable ticket number: OLF2026-XXXXXX
    v_ticket_num := 'OLF2026-' || upper(substr(v_ticket_id::text, 1, 6));

    INSERT INTO tickets (id, order_id, tier_id, scan_token, ticket_number)
    VALUES (v_ticket_id, p_order_id, p_tier_id, v_scan_token, v_ticket_num);
  END LOOP;

  RETURN p_quantity;
END;
$$;

REVOKE EXECUTE ON FUNCTION mint_tickets(UUID, UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION mint_tickets(UUID, UUID, INTEGER) TO service_role;

-- ---- confirm_payment, now delegating the mint loop ----
-- Body is otherwise identical to migration 000004.
CREATE OR REPLACE FUNCTION confirm_payment(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_tier  ticket_tiers%ROWTYPE;
BEGIN
  -- Lock the order row to prevent concurrent confirmation.
  -- Lock ordering across this schema is always order-then-tier; issue_comp_tickets
  -- and revoke_comp_order follow the same order to avoid deadlocks.
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'order_not_found');
  END IF;

  -- Idempotency: already processed
  IF v_order.status = 'paid' THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true);
  END IF;

  IF v_order.status NOT IN ('pending', 'awaiting_payment') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_status', 'status', v_order.status);
  END IF;

  -- Lock the tier and check capacity
  SELECT * INTO v_tier FROM ticket_tiers WHERE id = v_order.tier_id FOR UPDATE;

  IF (v_tier.sold_count + v_order.quantity) > v_tier.total_capacity THEN
    RETURN jsonb_build_object('success', false, 'error', 'sold_out');
  END IF;

  UPDATE ticket_tiers
  SET sold_count = sold_count + v_order.quantity,
      updated_at = now()
  WHERE id = v_tier.id;

  UPDATE orders
  SET status     = 'paid',
      paid_at    = now(),
      updated_at = now()
  WHERE id = p_order_id;

  PERFORM mint_tickets(p_order_id, v_order.tier_id, v_order.quantity);

  INSERT INTO email_log (order_id, type, status)
  VALUES (p_order_id, 'ticket_confirmation', 'pending');

  RETURN jsonb_build_object('success', true, 'tickets_issued', v_order.quantity);
END;
$$;
