-- =============================================================================
-- Shopio migration 0003 — seller contact + store location
--
-- These columns are part of the authoritative seller profile schema. Databases
-- provisioned from an older copy of the schema need them added before seller
-- registration/store settings can save a phone number or physical location.
-- Idempotent for databases already created from the current schema.
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(120) PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

DROP PROCEDURE IF EXISTS shopio_migrate_0003;
DELIMITER $$
CREATE PROCEDURE shopio_migrate_0003()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'seller_profiles'
      AND COLUMN_NAME = 'contact_phone'
  ) THEN
    ALTER TABLE seller_profiles ADD COLUMN contact_phone VARCHAR(32) NULL AFTER business_category;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'seller_profiles'
      AND COLUMN_NAME = 'region_id'
  ) THEN
    ALTER TABLE seller_profiles ADD COLUMN region_id BIGINT UNSIGNED NULL AFTER contact_phone;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'seller_profiles'
      AND COLUMN_NAME = 'city_id'
  ) THEN
    ALTER TABLE seller_profiles ADD COLUMN city_id BIGINT UNSIGNED NULL AFTER region_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'seller_profiles'
      AND COLUMN_NAME = 'address'
  ) THEN
    ALTER TABLE seller_profiles ADD COLUMN address VARCHAR(255) NULL AFTER city_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'seller_profiles'
      AND INDEX_NAME = 'idx_seller_city'
  ) THEN
    ALTER TABLE seller_profiles ADD KEY idx_seller_city (city_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'seller_profiles'
      AND CONSTRAINT_NAME = 'fk_seller_region'
  ) THEN
    ALTER TABLE seller_profiles
      ADD CONSTRAINT fk_seller_region FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'seller_profiles'
      AND CONSTRAINT_NAME = 'fk_seller_city'
  ) THEN
    ALTER TABLE seller_profiles
      ADD CONSTRAINT fk_seller_city FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL;
  END IF;
END$$
DELIMITER ;

CALL shopio_migrate_0003();
DROP PROCEDURE IF EXISTS shopio_migrate_0003;

INSERT INTO schema_migrations (version) VALUES ('0003_seller_contact_location')
  ON DUPLICATE KEY UPDATE version = version;
