-- ============================================================
-- Migration: Create ticketing core tables
-- ============================================================

-- Enable pgcrypto for HMAC token generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---- Ticket tiers (configured by admin) ----
CREATE TABLE ticket_tiers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  price_cents     INTEGER NOT NULL CHECK (price_cents >= 0),
  fee_cents       INTEGER NOT NULL DEFAULT 0 CHECK (fee_cents >= 0),
  total_capacity  INTEGER NOT NULL CHECK (total_capacity > 0),
  sold_count      INTEGER NOT NULL DEFAULT 0 CHECK (sold_count >= 0),
  sale_starts_at  TIMESTAMPTZ,
  sale_ends_at    TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT false,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Orders (one per checkout session) ----
CREATE TABLE orders (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mollie_payment_id       TEXT UNIQUE,
  mollie_idempotency_key  TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  tier_id                 UUID NOT NULL REFERENCES ticket_tiers(id),
  quantity                INTEGER NOT NULL DEFAULT 1
                          CHECK (quantity >= 1 AND quantity <= 10),
  total_cents             INTEGER NOT NULL CHECK (total_cents >= 0),
  buyer_email             TEXT NOT NULL CHECK (buyer_email ~* '^[^@]+@[^@]+\.[^@]+$'),
  buyer_name              TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN (
                            'pending','awaiting_payment','paid',
                            'expired','refunded','cancelled'
                          )),
  metadata                JSONB NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at                 TIMESTAMPTZ,
  expires_at              TIMESTAMPTZ NOT NULL DEFAULT now() + interval '15 minutes'
);

-- ---- Individual tickets (generated after payment confirmed) ----
CREATE TABLE tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tier_id         UUID NOT NULL REFERENCES ticket_tiers(id),
  scan_token      TEXT UNIQUE NOT NULL,
  ticket_number   TEXT UNIQUE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'valid'
                  CHECK (status IN ('valid','scanned','cancelled','transferred')),
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  scanned_at      TIMESTAMPTZ,
  scanned_by      TEXT,
  scan_location   TEXT
);

-- ---- Scan events — append-only audit log ----
CREATE TABLE scan_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID REFERENCES tickets(id),
  scan_token  TEXT NOT NULL,
  result      TEXT NOT NULL
              CHECK (result IN ('valid','already_scanned','invalid','cancelled')),
  scanner_id  TEXT NOT NULL,
  device_info JSONB NOT NULL DEFAULT '{}',
  scanned_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Email delivery queue and log ----
CREATE TABLE email_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES orders(id),
  resend_message_id   TEXT,
  type                TEXT NOT NULL DEFAULT 'ticket_confirmation',
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','sent','failed','bounced')),
  attempts            INTEGER NOT NULL DEFAULT 0,
  last_attempt_at     TIMESTAMPTZ,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- System config key-value store ----
CREATE TABLE config (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Admin users whitelist ----
CREATE TABLE admin_users (
  email     TEXT PRIMARY KEY,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
