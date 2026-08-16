-- ============================================================
-- Show the right name at the gate.
--
-- validate_scan() returns orders.buyer_name, which is correct for every ticket
-- that ever existed before group tickets: one buyer, one ticket. On a group
-- order it is actively misleading — ten different people walk up one at a time
-- and the scanner shows the group leader's name for all ten, so the volunteer at
-- the gate cannot use the name for anything.
--
-- The key stays 'buyer_name' rather than becoming 'attendee_name': Scanner.jsx
-- is a PWA that people load on their phone days before the event, and renaming
-- the field would blank the name on every already-installed copy. The value is
-- now "whose ticket this is"; the key is legacy.
--
-- Body otherwise identical to migration 000004.
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_scan(
  p_scan_token  TEXT,
  p_scanner_id  TEXT,
  p_device_info JSONB DEFAULT '{}'::jsonb
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
  SELECT * INTO v_ticket
  FROM tickets
  WHERE scan_token = p_scan_token
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO scan_events (scan_token, result, scanner_id, device_info)
    VALUES (p_scan_token, 'invalid', p_scanner_id, p_device_info);
    RETURN jsonb_build_object('result', 'invalid');
  END IF;

  IF v_ticket.status = 'cancelled' THEN
    INSERT INTO scan_events (ticket_id, scan_token, result, scanner_id, device_info)
    VALUES (v_ticket.id, p_scan_token, 'cancelled', p_scanner_id, p_device_info);
    RETURN jsonb_build_object(
      'result', 'cancelled',
      'ticket_number', v_ticket.ticket_number
    );
  END IF;

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

  SELECT * INTO v_order FROM orders WHERE id = v_ticket.order_id;
  SELECT * INTO v_tier  FROM ticket_tiers WHERE id = v_ticket.tier_id;

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
    'buyer_name',     COALESCE(NULLIF(v_ticket.attendee_name, ''), v_order.buyer_name),
    'tier_name',      v_tier.name
  );
END;
$$;
