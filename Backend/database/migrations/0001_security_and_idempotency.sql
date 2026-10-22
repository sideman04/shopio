-- =============================================================================
-- Shopio backend migration 0001: security, session, idempotency and
-- reservation infrastructure.
--
-- WHY THIS IS NEEDED
-- The supplied schema (shopio_database_v2_normalized.sql) is authoritative for
-- the domain (catalogue, orders, payments, refunds, payouts, reviews). It does
-- NOT contain any place to store:
--   * server-managed authentication sessions (opaque, revocable tokens),
--   * rate-limit counters / login attempt history,
--   * idempotency records for retryable checkout and payment operations,
--   * webhook replay-protection records,
--   * an explicit stock-reservation ledger.
-- These are additive only: no existing table, column, index, trigger, function
-- or view is modified or dropped, so the provided schema remains the single
-- source of truth for domain data.
--
-- Verified against MariaDB 13.0.2 (MySQL 8.0.16+ compatible subset:
-- InnoDB, CHECK constraints, JSON (LONGTEXT + json_valid) as converted by
-- MariaDB, INET6_ATON/INET6_NTOA, TIMESTAMP).
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ---------------------------------------------------------------------------
-- Migration bookkeeping
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(120) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Server-managed authentication sessions
-- Only the SHA-256 hash of the opaque token is persisted; the raw token lives
-- only in the client's HttpOnly cookie / Authorization header.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  csrf_hash CHAR(64) NULL,
  ip_address VARBINARY(16) NULL,
  user_agent VARCHAR(500) NULL,
  last_used_at DATETIME NULL,
  expires_at DATETIME NOT NULL,
  absolute_expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  revoked_reason VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_sessions_user (user_id, revoked_at, expires_at),
  KEY idx_sessions_expiry (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed window counters with optional lockout)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key VARCHAR(191) NOT NULL PRIMARY KEY,
  hits INT UNSIGNED NOT NULL DEFAULT 0,
  window_started_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  blocked_until DATETIME NULL,
  KEY idx_rate_limits_expiry (expires_at)
) ENGINE=InnoDB;

-- Login attempt history for auditing, anomaly detection and progressive delay.
CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email_hash CHAR(64) NOT NULL,
  ip_address VARBINARY(16) NULL,
  successful TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_login_attempts_email (email_hash, created_at),
  KEY idx_login_attempts_ip (ip_address, created_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Idempotency records for retryable write operations (checkout, refund, payout)
-- `subject_key` is either `user:<id>` or `guest:<session-fingerprint>` so the
-- uniqueness constraint is enforceable even for anonymous carts.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  scope VARCHAR(60) NOT NULL,
  subject_key VARCHAR(120) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  idem_key VARCHAR(191) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  status ENUM('in_progress','completed','failed') NOT NULL DEFAULT 'in_progress',
  response_status SMALLINT UNSIGNED NULL,
  response_body MEDIUMTEXT NULL,
  resource_type VARCHAR(60) NULL,
  resource_id BIGINT UNSIGNED NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_idem_scope_subject_key (scope, subject_key, idem_key),
  KEY idx_idem_expiry (expires_at),
  CONSTRAINT fk_idem_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Explicit stock reservation ledger.
--
-- Inventory strategy (single authoritative workflow):
--   * `inventory.quantity_on_hand` changes ONLY through `inventory_movements`
--     (enforced by the existing AFTER INSERT trigger). Never UPDATE on_hand in PHP.
--   * `inventory.quantity_reserved` is a hold counter; available stock is
--     `quantity_on_hand - quantity_reserved` (fn_variant_available_stock).
--     It changes ONLY through the guarded, row-locked updates in InventoryRepository.
--   * This table records the lifecycle of each hold so holds can be released or
--     expired deterministically, and so checkout is idempotent per order item.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_reservations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  variant_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NULL,
  quantity INT UNSIGNED NOT NULL,
  status ENUM('held','consumed','released','expired') NOT NULL DEFAULT 'held',
  expires_at DATETIME NOT NULL,
  resolved_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reservation_order_item (order_item_id),
  KEY idx_reservation_variant_status (variant_id, status),
  KEY idx_reservation_expiry (status, expires_at),
  CONSTRAINT fk_reservation_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id),
  CONSTRAINT fk_reservation_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_reservation_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
  CONSTRAINT chk_reservation_quantity CHECK (quantity > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Payment webhook replay protection / idempotent event processing.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(80) NOT NULL,
  event_id VARCHAR(191) NOT NULL,
  event_type VARCHAR(120) NULL,
  payload MEDIUMTEXT NULL,
  signature_valid TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('received','processed','ignored','failed') NOT NULL DEFAULT 'received',
  error_message VARCHAR(500) NULL,
  processed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_webhook_event (provider, event_id),
  KEY idx_webhook_status (provider, status, created_at)
) ENGINE=InnoDB;

INSERT INTO schema_migrations (version) VALUES ('0001_security_and_idempotency')
  ON DUPLICATE KEY UPDATE version = version;
