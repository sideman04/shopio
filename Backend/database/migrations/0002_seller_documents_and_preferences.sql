-- =============================================================================
-- Shopio migration 0002 — seller verification documents + admin replies
--
-- Apply after 0001_security_and_idempotency.sql. The migration is idempotent:
-- it can be run against a database created from the current authoritative
-- schema (where these objects already exist) as well as an older database.
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(120) PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Business documents uploaded by a seller for verification. Files are stored
-- outside the document root; only generated paths/URLs are persisted.
CREATE TABLE IF NOT EXISTS seller_documents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  seller_id BIGINT UNSIGNED NOT NULL,
  document_type VARCHAR(60) NOT NULL,
  label VARCHAR(120) NULL,
  file_url VARCHAR(2048) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  original_name VARCHAR(255) NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  review_notes VARCHAR(500) NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_seller_documents_seller (seller_id, created_at),
  CONSTRAINT fk_seller_documents_seller FOREIGN KEY (seller_id) REFERENCES seller_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_seller_documents_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- MySQL 8 does not support ADD COLUMN IF NOT EXISTS, so guard each ALTER with
-- information_schema. The procedure is dropped afterwards to leave no residue.
DROP PROCEDURE IF EXISTS shopio_migrate_0002;
DELIMITER $$
CREATE PROCEDURE shopio_migrate_0002()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'seller_profiles'
      AND COLUMN_NAME = 'preferences'
  ) THEN
    ALTER TABLE seller_profiles ADD COLUMN preferences JSON NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'product_reviews'
      AND COLUMN_NAME = 'admin_reply'
  ) THEN
    ALTER TABLE product_reviews ADD COLUMN admin_reply TEXT NULL AFTER seller_replied_at;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'product_reviews'
      AND COLUMN_NAME = 'admin_replied_at'
  ) THEN
    ALTER TABLE product_reviews ADD COLUMN admin_replied_at DATETIME NULL AFTER admin_reply;
  END IF;
END$$
DELIMITER ;

CALL shopio_migrate_0002();
DROP PROCEDURE IF EXISTS shopio_migrate_0002;

INSERT INTO schema_migrations (version) VALUES ('0002_seller_documents_and_preferences')
  ON DUPLICATE KEY UPDATE version = version;
