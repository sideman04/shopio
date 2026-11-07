-- Store the latest privacy choice per signed-in account or anonymous browser.
-- Anonymous browser tokens are SHA-256 hashed before they are stored here.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(120) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cookie_consents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  anonymous_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  necessary TINYINT(1) NOT NULL DEFAULT 1,
  functional TINYINT(1) NOT NULL DEFAULT 0,
  analytics TINYINT(1) NOT NULL DEFAULT 0,
  marketing TINYINT(1) NOT NULL DEFAULT 0,
  consent_status ENUM('accepted','rejected','customized') NOT NULL,
  policy_version VARCHAR(32) NOT NULL,
  consent_timestamp DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cookie_consents_user (user_id),
  UNIQUE KEY uq_cookie_consents_anonymous (anonymous_id),
  KEY idx_cookie_consents_policy_timestamp (policy_version, consent_timestamp),
  CONSTRAINT fk_cookie_consents_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_cookie_consents_identity CHECK (
    (user_id IS NOT NULL AND anonymous_id IS NULL)
    OR (user_id IS NULL AND anonymous_id IS NOT NULL)
  ),
  CONSTRAINT chk_cookie_consents_necessary CHECK (necessary = 1),
  CONSTRAINT chk_cookie_consents_boolean CHECK (
    functional IN (0, 1) AND analytics IN (0, 1) AND marketing IN (0, 1)
  )
) ENGINE=InnoDB;

INSERT INTO schema_migrations (version) VALUES ('0004_cookie_consents')
  ON DUPLICATE KEY UPDATE version = version;
