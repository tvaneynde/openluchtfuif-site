-- ============================================================
-- Group tickets (bundles) + per-attendee delivery + tier-scoped promo codes.
--
-- Three things land together because they are one feature to the organiser:
--
--   1. A tier can be a BUNDLE: "Groepsticket 10" costs €90 and yields 10
--      separate, individually scannable tickets (one free). The bundle size and
--      the bundle price are both configured from the dashboard.
--
--   2. A buyer can hand out the tickets themselves: one address for all ten, or
--      ten addresses so every person gets their own QR immediately.
--
--   3. A promo code can be restricted to one tier, so a "GROEP10" code discounts
--      the group bundle without also discounting single tickets.
--
-- THE INVARIANT THAT KEEPS SALES FIGURES HONEST
-- ---------------------------------------------
-- orders.quantity always counts TICKETS — never bundles. A 10-person group order
-- has quantity = 10. That means sold_count, total_capacity, the venue headcount
-- in issue_comp_tickets(), mint_tickets(), the scanner and every dashboard
-- aggregation keep working with no special case at all; one person is one
-- ticket is one unit of capacity, exactly as before.
--
-- Only the MONEY is per bundle. ticket_tiers.group_size is the divisor:
-- price_cents/fee_cents on a bundle tier are the price of ONE bundle, and
-- create-payment charges (price + fee) × (quantity / group_size). That divisor
-- lives in exactly two places (create-payment for the authoritative total,
-- Checkout.jsx for the preview) and nowhere in SQL, so no existing query can
-- accidentally read a bundle price as a per-ticket price.
-- ============================================================

-- ---- 1. Bundle tiers ------------------------------------------------------

ALTER TABLE ticket_tiers
  ADD COLUMN group_size INTEGER
  CHECK (group_size IS NULL OR group_size >= 2);

-- A bundle is an ordinary thing you buy online. Comp tiers are given away by
-- issue_comp_tickets() (which knows nothing about bundles) and door-sale rows
-- are cash at the gate with a placeholder capacity — a group_size on either
-- would be priced by code that never runs.
ALTER TABLE ticket_tiers
  ADD CONSTRAINT ticket_tiers_group_purchasable_check
  CHECK (group_size IS NULL OR (is_comp = false AND is_door_sale = false));

COMMENT ON COLUMN ticket_tiers.group_size IS
  'NULL = ordinary tier; price_cents/fee_cents are per ticket. '
  '>= 2 = bundle tier; price_cents/fee_cents are the price of ONE bundle of '
  'group_size tickets, and orders.quantity is still a count of TICKETS '
  '(a multiple of group_size). Never read price_cents as a per-ticket price '
  'without dividing by group_size.';

-- The public view gains the divisor so the checkout can render "€90 voor 10
-- tickets — €9,00 per ticket" and compute the same total the server will.
-- Appended at the end: CREATE OR REPLACE VIEW may only add columns after the
-- existing ones. Grants survive the replace.
CREATE OR REPLACE VIEW public_ticket_tiers AS
SELECT
  t.id,
  t.name,
  t.description,
  t.price_cents,
  t.fee_cents,
  t.sale_starts_at,
  t.sale_ends_at,
  t.is_door_sale,
  t.sort_order,
  (t.sold_count >= t.total_capacity)                    AS is_sold_out,
  (t.total_capacity - t.sold_count) BETWEEN 1 AND 20     AS is_almost_sold_out,
  t.group_size
FROM ticket_tiers t
WHERE t.is_active = true
  AND t.is_comp = false;

-- Migration 000036 re-granted ticket_tiers to anon column by column (to keep
-- sold_count/total_capacity hidden). A column added afterwards is NOT covered by
-- that grant, so name it explicitly or anon-side reads of the table break.
-- group_size is not a secret: it is printed on the tier card.
GRANT SELECT (group_size) ON public.ticket_tiers TO anon;

-- A bundle order is more tickets than the old public cap of 10. The real
-- per-order limit is a business rule that depends on the tier (10 tickets for a
-- single tier, 5 bundles for a group tier), and a CHECK constraint cannot read
-- ticket_tiers — so it is enforced in create-payment, exactly like the comp cap
-- lives in issue_comp_tickets(). This constraint keeps only the absolute
-- backstop: nothing sane produces a 100-ticket public order.
ALTER TABLE orders DROP CONSTRAINT orders_quantity_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_quantity_check
  CHECK (quantity >= 1 AND (order_type = 'comp' OR quantity <= 100));

-- ---- 2. Who each ticket is for -------------------------------------------

-- Collected at checkout, before the tickets exist. Kept out of orders.metadata
-- on purpose: this holds up to 100 third-party email addresses, and metadata
-- rides along in every order row a future query might expose.
CREATE TABLE order_attendees (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  seat_index INTEGER NOT NULL CHECK (seat_index >= 1),
  name       TEXT,
  email      TEXT CHECK (email IS NULL OR email ~* '^[^@]+@[^@]+\.[^@]+$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- seat_index is the ticket's position in the order (1..quantity); it is what
  -- mint_tickets() matches on, so it must be unique per order.
  UNIQUE (order_id, seat_index)
);

CREATE INDEX idx_order_attendees_order ON order_attendees (order_id, seat_index);

ALTER TABLE order_attendees ENABLE ROW LEVEL SECURITY;

-- "Any authenticated user is an admin" — the convention set in migration 000009.
CREATE POLICY "Authenticated full access order_attendees"
  ON order_attendees FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_attendees TO authenticated, service_role;
-- anon gets nothing, deliberately: no policy AND no grant. The buyer types these
-- addresses in, create-payment writes them with the service key, and nobody
-- holding the public anon key can read a guest list back out.

-- The resolved value, copied onto the ticket at mint time. NULL means "the
-- buyer" — which is every ticket sold before this migration.
ALTER TABLE tickets
  ADD COLUMN attendee_name  TEXT,
  ADD COLUMN attendee_email TEXT;

COMMENT ON COLUMN tickets.attendee_email IS
  'Lower-cased address this individual ticket was addressed to, or NULL for '
  '"goes to the buyer". Set by mint_tickets() from order_attendees.';

-- ---- 3. One mail per recipient -------------------------------------------

ALTER TABLE email_log ADD COLUMN recipient_email TEXT;

COMMENT ON COLUMN email_log.recipient_email IS
  'NULL = the historical behaviour: send to orders.buyer_email with every '
  'ticket on the order. Set = send to this address with only the tickets whose '
  'attendee_email matches it.';

-- Hard stop against the failure mode that has already hit this project twice:
-- a retry path inserting a second queue row and mailing a buyer their tickets
-- again. One row per (order, recipient) per mail type, forever. Resending is an
-- UPDATE back to 'pending' on the existing row, never an INSERT, so this costs
-- the resend buttons nothing.
CREATE UNIQUE INDEX email_log_one_per_recipient
  ON email_log (order_id, type, COALESCE(recipient_email, ''));

-- ---- 4. Minting, now attendee-aware --------------------------------------
-- Body identical to migration 000033 apart from the attendee lookup. The HMAC
-- expression and the ticket-number format are load-bearing: every ticket already
-- in the wild was computed exactly this way, and changing either would stop
-- those tickets scanning at the gate.
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
  v_att_name    TEXT;
  v_att_email   TEXT;
BEGIN
  SELECT value::text INTO v_secret FROM config WHERE key = 'hmac_secret';
  IF v_secret IS NULL OR length(v_secret) < 16 THEN
    RAISE EXCEPTION 'hmac_secret is missing or too short — refusing to mint tickets';
  END IF;

  FOR v_i IN 1..p_quantity LOOP
    v_ticket_id  := gen_random_uuid();
    v_scan_token := encode(hmac(v_ticket_id::text || p_order_id::text, v_secret, 'sha256'), 'hex');
    v_ticket_num := 'OLF2026-' || upper(substr(v_ticket_id::text, 1, 6));

    -- Seat v_i of this order. No row (an ordinary single-buyer order, or a comp
    -- batch, or a group where the buyer left a field blank) leaves both NULL,
    -- which reads as "this one goes to the buyer".
    v_att_name  := NULL;
    v_att_email := NULL;
    SELECT a.name, lower(NULLIF(trim(a.email), ''))
      INTO v_att_name, v_att_email
    FROM order_attendees a
    WHERE a.order_id = p_order_id AND a.seat_index = v_i;

    INSERT INTO tickets (
      id, order_id, tier_id, scan_token, ticket_number, attendee_name, attendee_email
    )
    VALUES (
      v_ticket_id, p_order_id, p_tier_id, v_scan_token, v_ticket_num,
      NULLIF(trim(COALESCE(v_att_name, '')), ''), v_att_email
    );
  END LOOP;

  RETURN p_quantity;
END;
$$;

REVOKE EXECUTE ON FUNCTION mint_tickets(UUID, UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION mint_tickets(UUID, UUID, INTEGER) TO service_role;

-- ---- 5. Confirmation, now fanning out ------------------------------------
-- Identical to migration 000033 except for the email_log block at the end.
CREATE OR REPLACE FUNCTION confirm_payment(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_order  orders%ROWTYPE;
  v_tier   ticket_tiers%ROWTYPE;
  v_extra  INTEGER := 0;
BEGIN
  -- Lock ordering across this schema is always order-then-tier; issue_comp_tickets
  -- and revoke_comp_order follow the same order to avoid deadlocks.
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'order_not_found');
  END IF;

  IF v_order.status = 'paid' THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true);
  END IF;

  IF v_order.status NOT IN ('pending', 'awaiting_payment') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_status', 'status', v_order.status);
  END IF;

  SELECT * INTO v_tier FROM ticket_tiers WHERE id = v_order.tier_id FOR UPDATE;

  -- Capacity is counted in tickets, and quantity is a ticket count for bundle
  -- orders too — so a 10-person group books 10 seats here, not 1.
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

  -- The buyer always gets one mail carrying every ticket on the order. They paid
  -- for them, they need the full PDF as a receipt, and it is the fallback when a
  -- guest's address turns out to be a typo.
  INSERT INTO email_log (order_id, type, status)
  VALUES (p_order_id, 'ticket_confirmation', 'pending')
  ON CONFLICT DO NOTHING;

  -- Plus one mail per distinct guest address, carrying only that guest's
  -- ticket(s). The buyer's own address is excluded — they already have
  -- everything, and a second copy of their own ticket reads as a bug.
  INSERT INTO email_log (order_id, type, status, recipient_email)
  SELECT DISTINCT p_order_id, 'ticket_confirmation', 'pending', t.attendee_email
  FROM tickets t
  WHERE t.order_id = p_order_id
    AND t.attendee_email IS NOT NULL
    AND t.attendee_email <> lower(trim(v_order.buyer_email))
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_extra = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'tickets_issued', v_order.quantity,
    'guest_emails', v_extra
  );
END;
$$;

-- ---- 6. Promo codes scoped to one tier -----------------------------------

ALTER TABLE promo_codes
  ADD COLUMN tier_id UUID REFERENCES ticket_tiers(id) ON DELETE CASCADE;

COMMENT ON COLUMN promo_codes.tier_id IS
  'NULL = valid on every tier (the historical behaviour). Set = the code is '
  'rejected for any other tier. Enforced in create-payment; Checkout.jsx '
  'applies the same rule so the buyer sees it before paying.';

-- anon already has table-level SELECT on promo_codes (migration 000017) so the
-- checkout can validate a code before submitting; the new column rides along and
-- is exactly what the browser needs to show "geldt niet voor dit ticket".
