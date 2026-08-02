-- ============================================================
-- Reconcile a sale whose Mollie webhook never landed.
--
-- Between 2026-07-27 and 2026-08-02 mollie-webhook was deployed with
-- verify_jwt = true, so Mollie's callback got 401 and confirm_payment never
-- ran. Those buyers paid and received nothing; their orders were swept to
-- 'expired' by expire_old_orders an hour later.
--
-- confirm_payment deliberately refuses anything outside
-- ('pending','awaiting_payment'), which is correct — an expired order must not
-- confirm itself. Reviving one is an explicit, audited act, so it gets its own
-- entry point rather than a loosened status check inside confirm_payment.
--
-- Why this is a function and not two statements in the edge function: flipping
-- 'expired' -> 'awaiting_payment' and then calling confirm_payment over the
-- wire leaves a window in which expire_old_orders (pg_cron, every 5 min) can
-- re-expire the row mid-flight, and confirm_payment would then return
-- invalid_status for an order we just took money for. Inside one function it is
-- one transaction, and the FOR UPDATE lock is held across both steps.
--
-- The caller is expected to have already confirmed with the Mollie API that the
-- payment is genuinely paid. This function does not and cannot verify that —
-- it has no network access — so it is service_role only.
-- ============================================================

CREATE OR REPLACE FUNCTION reconcile_confirm_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_order orders%ROWTYPE;
BEGIN
  -- Lock order first, then tier (inside confirm_payment) — the same lock
  -- ordering used by confirm_payment and issue_comp_tickets, so a concurrent
  -- webhook for this same order can't deadlock against us.
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'order_not_found');
  END IF;

  -- Comps have no Mollie payment and are inserted straight to 'paid'. Reviving
  -- one here would double-count it against the comp tier's sold_count.
  IF v_order.order_type <> 'sale' THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_a_sale', 'order_type', v_order.order_type);
  END IF;

  -- No Mollie payment means there is nothing the caller could have verified.
  IF v_order.mollie_payment_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_mollie_payment');
  END IF;

  -- Idempotent: running the reconcile twice must not mint a second set of
  -- tickets or queue a second email.
  IF v_order.status = 'paid' THEN
    RETURN jsonb_build_object('success', true, 'already_paid', true);
  END IF;

  -- Revive the terminal states the outage produced. 'refunded' is deliberately
  -- absent: a refund is a decision someone made after the fact, and silently
  -- un-refunding it would be worse than leaving it alone.
  IF v_order.status IN ('expired', 'cancelled') THEN
    UPDATE orders
    SET status     = 'awaiting_payment',
        -- expire_old_orders compares against now(); without this the row is
        -- eligible for re-expiry the moment this transaction commits.
        expires_at = now() + interval '1 hour',
        updated_at = now()
    WHERE id = p_order_id;
  ELSIF v_order.status NOT IN ('pending', 'awaiting_payment') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_status', 'status', v_order.status);
  END IF;

  -- Hand off to the normal path: capacity check, sold_count, mint_tickets and
  -- the queued confirmation email all happen exactly as they would have if the
  -- webhook had arrived on time.
  RETURN confirm_payment(p_order_id) || jsonb_build_object('reconciled', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION reconcile_confirm_order(UUID) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION reconcile_confirm_order(UUID) TO service_role;
