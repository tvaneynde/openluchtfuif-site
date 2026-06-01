-- ============================================================
-- Migration: Performance indexes
-- ============================================================

-- tickets: fast scan_token lookup (the hot path during scanning)
CREATE UNIQUE INDEX idx_tickets_scan_token ON tickets(scan_token);
CREATE INDEX idx_tickets_order_id ON tickets(order_id);
CREATE INDEX idx_tickets_status ON tickets(status) WHERE status = 'valid';

-- orders: webhook lookup by mollie ID
CREATE INDEX idx_orders_mollie_payment_id ON orders(mollie_payment_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_buyer_email ON orders(buyer_email);
CREATE INDEX idx_orders_expires_at ON orders(expires_at) WHERE status = 'awaiting_payment';

-- scan_events: dashboard feed (recent first per ticket)
CREATE INDEX idx_scan_events_ticket_id ON scan_events(ticket_id, scanned_at DESC);
CREATE INDEX idx_scan_events_scanned_at ON scan_events(scanned_at DESC);

-- email_log: queue worker picks up pending rows fast
CREATE INDEX idx_email_log_pending ON email_log(created_at)
  WHERE status = 'pending';

-- ticket_tiers: ordered display
CREATE INDEX idx_ticket_tiers_sort ON ticket_tiers(sort_order, created_at);
