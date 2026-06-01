-- ============================================================
-- Migration: Core business logic functions
-- ============================================================

-- ---- confirm_payment ----
-- Called by the Mollie webhook Edge Function (service role).
-- Atomically: validates order, decrements capacity, marks paid,
-- generates tickets with unique scan tokens, queues email.
-- Idempotent: safe to call multiple times for the same order.
CREATE OR REPLACE FUNCTION confirm_payment(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order       orders%ROWTYPE;
  v_tier        ticket_tiers%ROWTYPE;
  v_ticket_id   UUID;
  v_scan_token  TEXT;
  v_ticket_num  TEXT;
  v_i           INTEGER;
BEGIN
  -- Lock the order row to prevent concurrent confirmation
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'order_not_found');
  END IF;

  -- Idempotency: already processed
  IF v_order.status = 'paid' THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true);
  END IF;

  -- Only confirm if awaiting payment
  IF v_order.status NOT IN ('pending', 'awaiting_payment') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_status', 'status', v_order.status);
  END IF;

  -- Lock the tier and check capacity
  SELECT * INTO v_tier
  FROM ticket_tiers
  WHERE id = v_order.tier_id
  FOR UPDATE;

  IF (v_tier.sold_count + v_order.quantity) > v_tier.total_capacity THEN
    RETURN jsonb_build_object('success', false, 'error', 'sold_out');
  END IF;

  -- Decrement capacity
  UPDATE ticket_tiers
  SET sold_count = sold_count + v_order.quantity,
      updated_at = now()
  WHERE id = v_tier.id;

  -- Mark order as paid
  UPDATE orders
  SET status     = 'paid',
      paid_at    = now(),
      updated_at = now()
  WHERE id = p_order_id;

  -- Generate one ticket per quantity
  FOR v_i IN 1..v_order.quantity LOOP
    v_ticket_id  := gen_random_uuid();
    -- scan_token: HMAC of (ticket_id + order_id) — server secret set in config
    v_scan_token := encode(
      hmac(
        v_ticket_id::text || v_order.id::text,
        COALESCE(
          (SELECT value::text FROM config WHERE key = 'hmac_secret'),
          'fallback-change-this-in-production'
        ),
        'sha256'
      ),
      'hex'
    );
    -- Human-readable ticket number: OLF2026-XXXXXX
    v_ticket_num := 'OLF2026-' || upper(substr(v_ticket_id::text, 1, 6));

    INSERT INTO tickets (id, order_id, tier_id, scan_token, ticket_number)
    VALUES (v_ticket_id, p_order_id, v_order.tier_id, v_scan_token, v_ticket_num);
  END LOOP;

  -- Queue confirmation email
  INSERT INTO email_log (order_id, type, status)
  VALUES (p_order_id, 'ticket_confirmation', 'pending');

  RETURN jsonb_build_object('success', true, 'tickets_issued', v_order.quantity);
END;
$$;

-- ---- validate_scan ----
-- Called by the scanner Edge Function.
-- Atomically marks ticket as scanned and logs the event.
-- Returns a result code + context for the scanner UI.
CREATE OR REPLACE FUNCTION validate_scan(
  p_scan_token  TEXT,
  p_scanner_id  TEXT,
  p_device_info JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket  tickets%ROWTYPE;
  v_tier    ticket_tiers%ROWTYPE;
  v_order   orders%ROWTYPE;
BEGIN
  -- Find ticket by scan_token (unique index makes this fast)
  SELECT * INTO v_ticket
  FROM tickets
  WHERE scan_token = p_scan_token
  FOR UPDATE;  -- lock to prevent race condition on simultaneous scan

  -- Token not found → invalid/forged
  IF NOT FOUND THEN
    INSERT INTO scan_events (scan_token, result, scanner_id, device_info)
    VALUES (p_scan_token, 'invalid', p_scanner_id, p_device_info);
    RETURN jsonb_build_object('result', 'invalid');
  END IF;

  -- Ticket cancelled
  IF v_ticket.status = 'cancelled' THEN
    INSERT INTO scan_events (ticket_id, scan_token, result, scanner_id, device_info)
    VALUES (v_ticket.id, p_scan_token, 'cancelled', p_scanner_id, p_device_info);
    RETURN jsonb_build_object(
      'result', 'cancelled',
      'ticket_number', v_ticket.ticket_number
    );
  END IF;

  -- Already scanned
  IF v_ticket.status = 'scanned' THEN
    INSERT INTO scan_events (ticket_id, scan_token, result, scanner_id, device_info)
    VALUES (v_ticket.id, p_scan_token, 'already_scanned', p_scanner_id, p_device_info);
    RETURN jsonb_build_object(
      'result', 'already_scanned',
      'ticket_number', v_ticket.ticket_number,
      'scanned_at', v_ticket.scanned_at,
      'scanned_by', v_ticket.scanned_by
    );
  END IF;

  -- Get order info for buyer name
  SELECT * INTO v_order FROM orders WHERE id = v_ticket.order_id;
  SELECT * INTO v_tier  FROM ticket_tiers WHERE id = v_ticket.tier_id;

  -- Valid — mark as scanned atomically
  UPDATE tickets
  SET status      = 'scanned',
      scanned_at  = now(),
      scanned_by  = p_scanner_id
  WHERE id = v_ticket.id;

  INSERT INTO scan_events (ticket_id, scan_token, result, scanner_id, device_info)
  VALUES (v_ticket.id, p_scan_token, 'valid', p_scanner_id, p_device_info);

  RETURN jsonb_build_object(
    'result',         'valid',
    'ticket_number',  v_ticket.ticket_number,
    'buyer_name',     v_order.buyer_name,
    'tier_name',      v_tier.name
  );
END;
$$;

-- ---- expire_old_orders ----
-- Called by pg_cron every 5 minutes.
-- Marks stale awaiting_payment orders as expired and frees capacity
-- (capacity was never decremented for unpaid orders, so no rollback needed).
CREATE OR REPLACE FUNCTION expire_old_orders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE orders
  SET status     = 'expired',
      updated_at = now()
  WHERE status IN ('pending', 'awaiting_payment')
    AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
