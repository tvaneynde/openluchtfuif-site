-- The "Deurverkoop" card on the public tickets section was hardcoded in
-- Tickets.jsx, so the organizer couldn't edit its price/description without
-- a code change. Make it a real ticket_tiers row (editable from the existing
-- dashboard) while keeping it non-purchasable online: is_door_sale rows are
-- excluded from the checkout tier list and rejected server-side by
-- create-payment even if someone crafts a direct request.

ALTER TABLE ticket_tiers ADD COLUMN is_door_sale BOOLEAN NOT NULL DEFAULT false;

INSERT INTO ticket_tiers (
  name, description, price_cents, fee_cents,
  total_capacity, is_active, is_door_sale, sort_order
) VALUES (
  'Deurverkoop',
  'Beperkt beschikbaar aan de deur — vroeger boeken is zekerder.',
  2000,   -- €20.00, cash at the door
  0,
  999999, -- not tracked digitally — cash sales aren't counted against online capacity
  true,
  true,
  99
);
