-- ============================================================
-- Stop disclosing how many tickets are left.
--
-- The public site used to select('*') on ticket_tiers and compute
-- `total_capacity - sold_count` in the browser, so the exact remaining count was
-- in the network response whether or not it was rendered. Hiding the label alone
-- would be theatre.
--
-- Instead: a view that exposes only what a buyer needs, with scarcity reduced to
-- two booleans, and column-level SELECT on the count columns revoked from anon.
-- ============================================================

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
  -- Booleans, not counts: enough to disable the buy button and to nudge, but the
  -- number itself never leaves the server.
  (t.sold_count >= t.total_capacity)                    AS is_sold_out,
  (t.total_capacity - t.sold_count) BETWEEN 1 AND 20     AS is_almost_sold_out
FROM ticket_tiers t
WHERE t.is_active = true
  AND t.is_comp = false;

-- The view is owned by the migration role and runs with its privileges
-- (security_invoker defaults to off), so it can still read sold_count even after
-- the revoke below. Do NOT set security_invoker = on here — that would make the
-- view fail for anon once the column privileges are gone.
GRANT SELECT ON public_ticket_tiers TO anon, authenticated;

-- Door-sale rows carry a placeholder capacity of 999999 and are not tracked
-- digitally, so their flags are meaningless — never render them.
COMMENT ON VIEW public_ticket_tiers IS
  'Buyer-facing tier list. Excludes comp tiers and inactive tiers, and exposes '
  'scarcity as booleans only — sold_count/total_capacity are deliberately absent. '
  'Ignore is_sold_out/is_almost_sold_out for is_door_sale rows.';

-- Now actually take the numbers away from anon. Table-level SELECT was granted
-- in migration 000010; re-grant it per column, omitting the two counts.
REVOKE SELECT ON public.ticket_tiers FROM anon;
GRANT SELECT (
  id, name, description, price_cents, fee_cents,
  sale_starts_at, sale_ends_at, is_active, is_door_sale, is_comp,
  sort_order, created_at, updated_at
) ON public.ticket_tiers TO anon;
