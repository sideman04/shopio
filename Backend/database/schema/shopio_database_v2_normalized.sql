-- Shopio Marketplace Database v2
-- MySQL 8.0.16+ / InnoDB / utf8mb4
-- Normalized core (approximately 3NF), with explicit stored functions and triggers.
-- Run on a NEW database. Do not run over an existing production database without a migration.
-- PHP must still enforce authorization, transactions, validation, and payment-provider security.

CREATE DATABASE IF NOT EXISTS shopio_v2
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE shopio_v2;
SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ---------------------------------------------------------------------------
-- LOOKUP TABLES / USERS / ROLES
-- ---------------------------------------------------------------------------

CREATE TABLE roles (
  id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(32) NOT NULL UNIQUE,
  label VARCHAR(80) NOT NULL
) ENGINE=InnoDB;

INSERT INTO roles (code,label) VALUES
 ('customer','Customer'),('seller','Seller'),('admin','Administrator');

CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  phone VARCHAR(32) NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('pending','active','suspended','disabled') NOT NULL DEFAULT 'active',
  email_verified_at DATETIME NULL,
  phone_verified_at DATETIME NULL,
  last_login_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_users_status_created (status,created_at)
) ENGINE=InnoDB;

-- Many-to-many: one account may have more than one role.
CREATE TABLE user_roles (
  user_id BIGINT UNSIGNED NOT NULL,
  role_id SMALLINT UNSIGNED NOT NULL,
  assigned_by BIGINT UNSIGNED NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id,role_id),
  KEY idx_user_roles_role (role_id,user_id),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT fk_user_roles_assigner FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE auth_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  purpose ENUM('email_verify','password_reset','phone_verify') NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_auth_tokens_user_purpose (user_id,purpose,expires_at),
  CONSTRAINT fk_auth_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE countries (
  code CHAR(2) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;
INSERT INTO countries (code,name) VALUES ('TZ','Tanzania'),('KE','Kenya'),('UG','Uganda');

CREATE TABLE regions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  country_code CHAR(2) NOT NULL,
  name VARCHAR(100) NOT NULL,
  UNIQUE KEY uq_region_country_name (country_code,name),
  CONSTRAINT fk_regions_country FOREIGN KEY (country_code) REFERENCES countries(code)
) ENGINE=InnoDB;

CREATE TABLE cities (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  region_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  UNIQUE KEY uq_city_region_name (region_id,name),
  CONSTRAINT fk_cities_region FOREIGN KEY (region_id) REFERENCES regions(id)
) ENGINE=InnoDB;

CREATE TABLE addresses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  label VARCHAR(60) NULL,
  recipient_name VARCHAR(150) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  city_id BIGINT UNSIGNED NOT NULL,
  district VARCHAR(100) NULL,
  street_address VARCHAR(255) NOT NULL,
  postal_code VARCHAR(24) NULL,
  delivery_instructions VARCHAR(500) NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_addresses_user_default (user_id,is_default),
  CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_addresses_city FOREIGN KEY (city_id) REFERENCES cities(id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- SELLERS
-- ---------------------------------------------------------------------------

CREATE TABLE seller_profiles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL UNIQUE,
  store_name VARCHAR(150) NOT NULL,
  store_slug VARCHAR(180) NOT NULL UNIQUE,
  store_description TEXT NULL,
  logo_url VARCHAR(2048) NULL,
  banner_url VARCHAR(2048) NULL,
  business_category VARCHAR(120) NULL,
  contact_phone VARCHAR(32) NULL,
  region_id BIGINT UNSIGNED NULL,
  city_id BIGINT UNSIGNED NULL,
  address VARCHAR(255) NULL,
  verification_status ENUM('not_submitted','pending','approved','rejected') NOT NULL DEFAULT 'not_submitted',
  verification_notes TEXT NULL,
  verified_by BIGINT UNSIGNED NULL,
  verified_at DATETIME NULL,
  commission_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  status ENUM('active','paused','suspended','closed') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_seller_status_verification (status,verification_status),
  KEY idx_seller_city (city_id),
  CONSTRAINT fk_seller_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_seller_region FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL,
  CONSTRAINT fk_seller_city FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL,
  CONSTRAINT fk_seller_verifier FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_seller_commission CHECK (commission_rate BETWEEN 0 AND 100)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- CATALOG: CATEGORIES / PRODUCTS / VARIANTS / STOCK
-- ---------------------------------------------------------------------------

CREATE TABLE categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_id BIGINT UNSIGNED NULL,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(150) NOT NULL UNIQUE,
  description TEXT NULL,
  image_url VARCHAR(2048) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_categories_parent_status (parent_id,status,sort_order),
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE products (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  seller_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NULL,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(230) NOT NULL UNIQUE,
  short_description VARCHAR(500) NULL,
  description MEDIUMTEXT NULL,
  brand VARCHAR(120) NULL,
  condition_type ENUM('new','used','refurbished') NOT NULL DEFAULT 'new',
  status ENUM('draft','pending_review','active','rejected','archived') NOT NULL DEFAULT 'draft',
  rejection_reason TEXT NULL,
  approved_by BIGINT UNSIGNED NULL,
  approved_at DATETIME NULL,
  currency CHAR(3) NOT NULL DEFAULT 'TZS',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  KEY idx_products_catalog (status,category_id,created_at,id),
  KEY idx_products_seller_status (seller_id,status,updated_at),
  FULLTEXT KEY ft_products_search (name,short_description,description,brand),
  CONSTRAINT fk_products_seller FOREIGN KEY (seller_id) REFERENCES seller_profiles(id),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_products_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Every purchasable SKU is a variant. Simple products have one default variant.
-- Price and stock belong to the SKU, not duplicated on products.
CREATE TABLE product_variants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  sku VARCHAR(100) NOT NULL UNIQUE,
  variant_name VARCHAR(150) NOT NULL DEFAULT 'Default',
  price DECIMAL(13,2) NOT NULL,
  compare_at_price DECIMAL(13,2) NULL,
  cost_price DECIMAL(13,2) NULL,
  weight_grams INT UNSIGNED NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_variants_product_active (product_id,is_active),
  KEY idx_variants_price (price),
  CONSTRAINT fk_variants_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT chk_variant_price CHECK (price >= 0),
  CONSTRAINT chk_variant_compare CHECK (compare_at_price IS NULL OR compare_at_price >= price),
  CONSTRAINT chk_variant_cost CHECK (cost_price IS NULL OR cost_price >= 0)
) ENGINE=InnoDB;

-- Normalized variant options (e.g. Color=Black, Size=M), not a JSON attribute blob.
CREATE TABLE product_option_types (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(60) NOT NULL,
  UNIQUE KEY uq_product_option_name (product_id,name),
  CONSTRAINT fk_option_types_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE product_option_values (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  option_type_id BIGINT UNSIGNED NOT NULL,
  value VARCHAR(100) NOT NULL,
  UNIQUE KEY uq_option_value (option_type_id,value),
  CONSTRAINT fk_option_values_type FOREIGN KEY (option_type_id) REFERENCES product_option_types(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE variant_option_values (
  variant_id BIGINT UNSIGNED NOT NULL,
  option_value_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (variant_id,option_value_id),
  KEY idx_variant_option_value (option_value_id,variant_id),
  CONSTRAINT fk_vov_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
  CONSTRAINT fk_vov_value FOREIGN KEY (option_value_id) REFERENCES product_option_values(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE product_images (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  image_url VARCHAR(2048) NOT NULL,
  alt_text VARCHAR(255) NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_product_images_order (product_id,sort_order),
  CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE inventory (
  variant_id BIGINT UNSIGNED PRIMARY KEY,
  quantity_on_hand INT UNSIGNED NOT NULL DEFAULT 0,
  quantity_reserved INT UNSIGNED NOT NULL DEFAULT 0,
  low_stock_threshold INT UNSIGNED NOT NULL DEFAULT 5,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_inventory_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id),
  CONSTRAINT chk_inventory_reserved CHECK (quantity_reserved <= quantity_on_hand)
) ENGINE=InnoDB;

CREATE TABLE inventory_movements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  variant_id BIGINT UNSIGNED NOT NULL,
  changed_by BIGINT UNSIGNED NULL,
  movement_type ENUM('opening','restock','sale','return','adjustment','release_reservation') NOT NULL,
  quantity_delta INT NOT NULL,
  reference_type VARCHAR(40) NULL,
  reference_id BIGINT UNSIGNED NULL,
  note VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_inventory_variant_date (variant_id,created_at),
  KEY idx_inventory_reference (reference_type,reference_id),
  CONSTRAINT fk_movement_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id),
  CONSTRAINT fk_movement_user FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- CART / WISHLIST
-- ---------------------------------------------------------------------------

CREATE TABLE carts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  session_token_hash CHAR(64) NULL UNIQUE,
  status ENUM('active','converted','abandoned') NOT NULL DEFAULT 'active',
  expires_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_carts_user_status (user_id,status,updated_at),
  KEY idx_carts_expiry (status,expires_at),
  CONSTRAINT fk_carts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE cart_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cart_id BIGINT UNSIGNED NOT NULL,
  variant_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cart_variant (cart_id,variant_id),
  CONSTRAINT fk_cart_item_cart FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_item_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id),
  CONSTRAINT chk_cart_quantity CHECK (quantity > 0)
) ENGINE=InnoDB;

CREATE TABLE wishlists (
  user_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id,product_id),
  KEY idx_wishlist_product (product_id),
  CONSTRAINT fk_wishlist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_wishlist_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- PROMOTIONS
-- ---------------------------------------------------------------------------

CREATE TABLE coupons (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(60) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  discount_type ENUM('percentage','fixed') NOT NULL,
  discount_value DECIMAL(13,2) NOT NULL,
  minimum_order_amount DECIMAL(13,2) NOT NULL DEFAULT 0,
  maximum_discount_amount DECIMAL(13,2) NULL,
  usage_limit INT UNSIGNED NULL,
  per_user_limit INT UNSIGNED NULL,
  starts_at DATETIME NULL,
  expires_at DATETIME NULL,
  status ENUM('active','inactive','expired') NOT NULL DEFAULT 'active',
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_coupon_status_dates (status,starts_at,expires_at),
  CONSTRAINT fk_coupon_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_coupon_discount CHECK (discount_value > 0),
  CONSTRAINT chk_coupon_minimum CHECK (minimum_order_amount >= 0)
) ENGINE=InnoDB;

CREATE TABLE promotional_banners (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  subtitle VARCHAR(255) NULL,
  image_url VARCHAR(2048) NULL,
  button_text VARCHAR(60) NULL,
  target_url VARCHAR(2048) NULL,
  placement ENUM('home_hero','home_promo','category','other') NOT NULL DEFAULT 'home_promo',
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('draft','active','inactive') NOT NULL DEFAULT 'draft',
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_banner_placement_status (placement,status,sort_order),
  CONSTRAINT fk_banner_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- ORDERS / ORDER ITEMS
-- ---------------------------------------------------------------------------

CREATE TABLE orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(40) NOT NULL UNIQUE,
  user_id BIGINT UNSIGNED NULL,
  customer_email VARCHAR(254) NOT NULL,
  customer_name VARCHAR(150) NOT NULL,
  customer_phone VARCHAR(32) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'TZS',
  status ENUM('pending','confirmed','processing','partially_shipped','shipped','delivered','cancelled','refunded') NOT NULL DEFAULT 'pending',
  payment_status ENUM('unpaid','pending','paid','partially_refunded','refunded','failed') NOT NULL DEFAULT 'unpaid',
  fulfillment_status ENUM('unfulfilled','partial','fulfilled','returned') NOT NULL DEFAULT 'unfulfilled',
  shipping_address_line VARCHAR(255) NOT NULL,
  shipping_district VARCHAR(100) NULL,
  shipping_city VARCHAR(100) NOT NULL,
  shipping_region VARCHAR(100) NOT NULL,
  shipping_country_code CHAR(2) NOT NULL DEFAULT 'TZ',
  shipping_postal_code VARCHAR(24) NULL,
  shipping_instructions VARCHAR(500) NULL,
  customer_note TEXT NULL,
  placed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at DATETIME NULL,
  delivered_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_orders_user_date (user_id,placed_at),
  KEY idx_orders_status_date (status,placed_at),
  KEY idx_orders_payment_date (payment_status,placed_at),
  KEY idx_orders_email (customer_email),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_country FOREIGN KEY (shipping_country_code) REFERENCES countries(code)
) ENGINE=InnoDB;

-- Monetary totals are computed from order_items and order_adjustments; do not store duplicate subtotal/total columns.
-- Product/SKU/title/price are snapshots on order_items intentionally, to preserve historical purchases.
CREATE TABLE order_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  variant_id BIGINT UNSIGNED NULL,
  seller_id BIGINT UNSIGNED NULL,
  product_name_snapshot VARCHAR(200) NOT NULL,
  sku_snapshot VARCHAR(100) NOT NULL,
  variant_snapshot VARCHAR(150) NOT NULL DEFAULT 'Default',
  image_url_snapshot VARCHAR(2048) NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_price DECIMAL(13,2) NOT NULL,
  discount_amount DECIMAL(13,2) NOT NULL DEFAULT 0,
  seller_commission_rate DECIMAL(5,2) NOT NULL,
  fulfillment_status ENUM('unfulfilled','processing','shipped','delivered','cancelled','returned') NOT NULL DEFAULT 'unfulfilled',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_order_items_order (order_id),
  KEY idx_order_items_seller_status (seller_id,fulfillment_status,created_at),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_order_items_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL,
  CONSTRAINT fk_order_items_seller FOREIGN KEY (seller_id) REFERENCES seller_profiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_order_item_values CHECK (quantity > 0 AND unit_price >= 0 AND discount_amount >= 0 AND seller_commission_rate BETWEEN 0 AND 100)
) ENGINE=InnoDB;

CREATE TABLE order_adjustments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  adjustment_type ENUM('shipping','tax','discount','fee','refund_adjustment') NOT NULL,
  label VARCHAR(150) NOT NULL,
  amount DECIMAL(13,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_adjustments_order_type (order_id,adjustment_type),
  CONSTRAINT fk_adjustment_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE order_status_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  changed_by BIGINT UNSIGNED NULL,
  old_status VARCHAR(40) NULL,
  new_status VARCHAR(40) NOT NULL,
  note VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_order_history (order_id,created_at),
  CONSTRAINT fk_order_history_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_history_user FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE coupons_applied (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  coupon_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  discount_amount DECIMAL(13,2) NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_coupon_order (coupon_id,order_id),
  KEY idx_coupon_applied_user (coupon_id,user_id),
  CONSTRAINT fk_coupon_applied_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id),
  CONSTRAINT fk_coupon_applied_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_coupon_applied_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_coupon_applied_discount CHECK (discount_amount >= 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- PAYMENTS / SHIPMENTS / REFUNDS / SELLER PAYOUTS
-- ---------------------------------------------------------------------------

CREATE TABLE payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(80) NOT NULL,
  provider_reference VARCHAR(190) NULL,
  idempotency_key VARCHAR(190) NULL UNIQUE,
  amount DECIMAL(13,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'TZS',
  status ENUM('initiated','pending','succeeded','failed','cancelled','refunded','partially_refunded') NOT NULL DEFAULT 'initiated',
  payment_method VARCHAR(60) NULL,
  paid_at DATETIME NULL,
  failure_code VARCHAR(100) NULL,
  failure_message VARCHAR(500) NULL,
  provider_payload JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_payments_order_status (order_id,status),
  KEY idx_payments_provider_ref (provider,provider_reference),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT chk_payment_amount CHECK (amount > 0)
) ENGINE=InnoDB;

CREATE TABLE shipments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  carrier VARCHAR(100) NULL,
  service_name VARCHAR(100) NULL,
  tracking_number VARCHAR(150) NULL,
  status ENUM('pending','packed','shipped','in_transit','delivered','failed','returned') NOT NULL DEFAULT 'pending',
  shipping_cost DECIMAL(13,2) NOT NULL DEFAULT 0,
  shipped_at DATETIME NULL,
  delivered_at DATETIME NULL,
  tracking_url VARCHAR(2048) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_shipments_order_status (order_id,status),
  KEY idx_shipments_tracking (tracking_number),
  CONSTRAINT fk_shipments_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT chk_shipment_cost CHECK (shipping_cost >= 0)
) ENGINE=InnoDB;

CREATE TABLE refunds (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  requested_by BIGINT UNSIGNED NULL,
  processed_by BIGINT UNSIGNED NULL,
  amount DECIMAL(13,2) NOT NULL,
  reason VARCHAR(500) NULL,
  status ENUM('requested','approved','rejected','processing','succeeded','failed') NOT NULL DEFAULT 'requested',
  provider_reference VARCHAR(190) NULL,
  processed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_refunds_order_status (order_id,status),
  CONSTRAINT fk_refunds_payment FOREIGN KEY (payment_id) REFERENCES payments(id),
  CONSTRAINT fk_refunds_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_refunds_requester FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_refunds_processor FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_refund_amount CHECK (amount > 0)
) ENGINE=InnoDB;

CREATE TABLE seller_payouts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  seller_id BIGINT UNSIGNED NOT NULL,
  payout_reference VARCHAR(100) NOT NULL UNIQUE,
  amount DECIMAL(13,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'TZS',
  payout_method VARCHAR(60) NULL,
  destination_label VARCHAR(150) NULL,
  status ENUM('requested','pending','processing','paid','rejected','failed') NOT NULL DEFAULT 'requested',
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME NULL,
  processed_by BIGINT UNSIGNED NULL,
  provider_reference VARCHAR(190) NULL,
  admin_note VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_payout_seller_status (seller_id,status,requested_at),
  KEY idx_payout_status_date (status,requested_at),
  CONSTRAINT fk_payout_seller FOREIGN KEY (seller_id) REFERENCES seller_profiles(id),
  CONSTRAINT fk_payout_processor FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_payout_amount CHECK (amount > 0)
) ENGINE=InnoDB;

CREATE TABLE payout_items (
  payout_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(13,2) NOT NULL,
  PRIMARY KEY (payout_id,order_item_id),
  CONSTRAINT fk_payout_item_payout FOREIGN KEY (payout_id) REFERENCES seller_payouts(id) ON DELETE CASCADE,
  CONSTRAINT fk_payout_item_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id),
  CONSTRAINT chk_payout_item_amount CHECK (amount > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- REVIEWS / NOTIFICATIONS / SUPPORT / SETTINGS / AUDIT
-- ---------------------------------------------------------------------------

CREATE TABLE product_reviews (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NULL,
  rating TINYINT UNSIGNED NOT NULL,
  title VARCHAR(180) NULL,
  review_text TEXT NULL,
  status ENUM('pending','published','hidden','rejected') NOT NULL DEFAULT 'pending',
  seller_reply TEXT NULL,
  seller_replied_at DATETIME NULL,
  moderated_by BIGINT UNSIGNED NULL,
  moderated_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_review_order_item (user_id,order_item_id),
  KEY idx_reviews_product_status (product_id,status,created_at),
  KEY idx_reviews_moderation (status,created_at),
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_reviews_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE SET NULL,
  CONSTRAINT fk_reviews_moderator FOREIGN KEY (moderated_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_review_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB;

CREATE TABLE review_reports (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  review_id BIGINT UNSIGNED NOT NULL,
  reported_by BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(500) NOT NULL,
  status ENUM('open','reviewing','dismissed','action_taken') NOT NULL DEFAULT 'open',
  resolved_by BIGINT UNSIGNED NULL,
  resolved_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_review_reports_status (status,created_at),
  CONSTRAINT fk_report_review FOREIGN KEY (review_id) REFERENCES product_reviews(id) ON DELETE CASCADE,
  CONSTRAINT fk_reporter FOREIGN KEY (reported_by) REFERENCES users(id),
  CONSTRAINT fk_report_resolver FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(80) NOT NULL,
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  target_url VARCHAR(2048) NULL,
  data JSON NULL,
  read_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notifications_unread (user_id,read_at,created_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE support_messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(254) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  status ENUM('new','in_progress','resolved','closed') NOT NULL DEFAULT 'new',
  assigned_to BIGINT UNSIGNED NULL,
  resolved_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_support_status_date (status,created_at),
  CONSTRAINT fk_support_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_support_assignee FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE site_settings (
  setting_key VARCHAR(120) PRIMARY KEY,
  setting_value JSON NOT NULL,
  description VARCHAR(255) NULL,
  updated_by BIGINT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_settings_updater FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_user_id BIGINT UNSIGNED NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  ip_address VARBINARY(16) NULL,
  user_agent VARCHAR(500) NULL,
  details JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_actor_date (actor_user_id,created_at),
  KEY idx_audit_entity (entity_type,entity_id,created_at),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- VIEWS: derive totals/ratings rather than storing duplicate aggregates.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_product_rating_summary AS
SELECT p.id AS product_id,
       COALESCE(ROUND(AVG(CASE WHEN r.status='published' THEN r.rating END),2),0.00) AS average_rating,
       SUM(CASE WHEN r.status='published' THEN 1 ELSE 0 END) AS review_count
FROM products p
LEFT JOIN product_reviews r ON r.product_id=p.id
GROUP BY p.id;

CREATE OR REPLACE VIEW v_order_totals AS
SELECT o.id AS order_id,
       COALESCE(i.items_subtotal,0.00) AS items_subtotal,
       COALESCE(i.items_discount,0.00) AS items_discount,
       COALESCE(a.shipping_total,0.00) AS shipping_total,
       COALESCE(a.tax_total,0.00) AS tax_total,
       COALESCE(a.other_adjustments,0.00) AS other_adjustments,
       COALESCE(i.items_subtotal,0.00) - COALESCE(i.items_discount,0.00)
         + COALESCE(a.shipping_total,0.00) + COALESCE(a.tax_total,0.00)
         + COALESCE(a.other_adjustments,0.00) AS grand_total
FROM orders o
LEFT JOIN (
  SELECT order_id, SUM(quantity*unit_price) AS items_subtotal,
         SUM(discount_amount) AS items_discount
  FROM order_items GROUP BY order_id
) i ON i.order_id=o.id
LEFT JOIN (
  SELECT order_id,
         SUM(CASE WHEN adjustment_type='shipping' THEN amount ELSE 0 END) AS shipping_total,
         SUM(CASE WHEN adjustment_type='tax' THEN amount ELSE 0 END) AS tax_total,
         SUM(CASE
           WHEN adjustment_type='discount' THEN -amount
           WHEN adjustment_type IN ('fee','refund_adjustment') THEN amount
           ELSE 0
         END) AS other_adjustments
  FROM order_adjustments GROUP BY order_id
) a ON a.order_id=o.id;

-- ---------------------------------------------------------------------------
-- STORED FUNCTIONS
-- ---------------------------------------------------------------------------

DELIMITER $$

CREATE FUNCTION fn_order_total(p_order_id BIGINT UNSIGNED)
RETURNS DECIMAL(15,2)
READS SQL DATA
BEGIN
  DECLARE v_total DECIMAL(15,2) DEFAULT 0.00;
  SELECT COALESCE(grand_total,0.00) INTO v_total
  FROM v_order_totals WHERE order_id=p_order_id;
  RETURN COALESCE(v_total,0.00);
END$$

CREATE FUNCTION fn_product_average_rating(p_product_id BIGINT UNSIGNED)
RETURNS DECIMAL(4,2)
READS SQL DATA
BEGIN
  DECLARE v_rating DECIMAL(4,2) DEFAULT 0.00;
  SELECT COALESCE(ROUND(AVG(rating),2),0.00) INTO v_rating
  FROM product_reviews
  WHERE product_id=p_product_id AND status='published';
  RETURN v_rating;
END$$

CREATE FUNCTION fn_variant_available_stock(p_variant_id BIGINT UNSIGNED)
RETURNS BIGINT
READS SQL DATA
BEGIN
  DECLARE v_available BIGINT DEFAULT 0;
  SELECT COALESCE(quantity_on_hand-quantity_reserved,0) INTO v_available
  FROM inventory WHERE variant_id=p_variant_id;
  RETURN v_available;
END$$

-- ---------------------------------------------------------------------------
-- TRIGGERS
-- ---------------------------------------------------------------------------

-- Create the inventory row automatically when a SKU is created.
CREATE TRIGGER trg_variant_after_insert
AFTER INSERT ON product_variants
FOR EACH ROW
BEGIN
  INSERT INTO inventory (variant_id,quantity_on_hand,quantity_reserved,low_stock_threshold)
  VALUES (NEW.id,0,0,5);
END$$

-- Prevent invalid stock movement; the stock update itself is handled atomically here.
CREATE TRIGGER trg_inventory_movement_before_insert
BEFORE INSERT ON inventory_movements
FOR EACH ROW
BEGIN
  DECLARE v_on_hand INT UNSIGNED DEFAULT 0;
  DECLARE v_reserved INT UNSIGNED DEFAULT 0;
  SELECT quantity_on_hand,quantity_reserved INTO v_on_hand,v_reserved
  FROM inventory WHERE variant_id=NEW.variant_id FOR UPDATE;

  IF NEW.quantity_delta = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Inventory movement cannot be zero';
  END IF;

  IF v_on_hand + NEW.quantity_delta < 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Insufficient stock for this movement';
  END IF;

  IF NEW.movement_type='sale' AND v_on_hand + NEW.quantity_delta < v_reserved THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Sale would consume reserved stock';
  END IF;
END$$

CREATE TRIGGER trg_inventory_movement_after_insert
AFTER INSERT ON inventory_movements
FOR EACH ROW
BEGIN
  UPDATE inventory
  SET quantity_on_hand = quantity_on_hand + NEW.quantity_delta
  WHERE variant_id=NEW.variant_id;
END$$

-- Maintain order status history automatically.
CREATE TRIGGER trg_orders_after_insert
AFTER INSERT ON orders
FOR EACH ROW
BEGIN
  INSERT INTO order_status_history(order_id,changed_by,old_status,new_status,note)
  VALUES(NEW.id,NULL,NULL,NEW.status,'Order created');
END$$

CREATE TRIGGER trg_orders_after_status_update
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
  IF OLD.status <> NEW.status THEN
    INSERT INTO order_status_history(order_id,changed_by,old_status,new_status,note)
    VALUES(NEW.id,NULL,OLD.status,NEW.status,'Status changed');
  END IF;
END$$

-- Validate review ownership link when an order item is supplied.
CREATE TRIGGER trg_review_before_insert
BEFORE INSERT ON product_reviews
FOR EACH ROW
BEGIN
  DECLARE v_order_user_id BIGINT UNSIGNED DEFAULT NULL;
  DECLARE v_order_product_id BIGINT UNSIGNED DEFAULT NULL;
  IF NEW.order_item_id IS NOT NULL THEN
    SELECT o.user_id, pv.product_id
      INTO v_order_user_id, v_order_product_id
    FROM order_items oi
    JOIN orders o ON o.id=oi.order_id
    LEFT JOIN product_variants pv ON pv.id=oi.variant_id
    WHERE oi.id=NEW.order_item_id;

    IF v_order_user_id IS NULL OR v_order_user_id <> NEW.user_id THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Review order item does not belong to this user';
    END IF;

    IF v_order_product_id IS NULL OR v_order_product_id <> NEW.product_id THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Review product does not match the purchased item';
    END IF;
  END IF;
END$$

DELIMITER ;

-- ---------------------------------------------------------------------------
-- SEED CATEGORIES
-- ---------------------------------------------------------------------------
INSERT INTO categories(name,slug,description,sort_order,status) VALUES
 ('Furniture','furniture','Furniture for homes and offices',1,'active'),
 ('Electronics','electronics','Electronic devices and accessories',2,'active'),
 ('Fashion','fashion','Clothing and fashion accessories',3,'active'),
 ('Home Decor','home-decor','Decor for living spaces',4,'active'),
 ('Accessories','accessories','Lifestyle accessories',5,'active');

-- ---------------------------------------------------------------------------
-- IMPLEMENTATION NOTES
-- ---------------------------------------------------------------------------
-- 1. Product creation should insert products, then variants; each variant gets inventory row via trigger.
-- 2. Use inventory_movements for stock receipts/sales/adjustments. Never directly update stock in PHP.
-- 3. Checkout must use a transaction, lock inventory rows with SELECT ... FOR UPDATE,
--    validate available stock, create order + item snapshots + adjustments, and write movements.
-- 4. A stock reservation workflow should update quantity_reserved transactionally; add explicit
--    reservation tables/expiry handling before enabling high-volume checkout.
-- 5. The order total view uses positive amounts for shipping/tax/fees and discounts are represented
--    as positive amounts subtracted by the PHP calculation. Adapt view if a different convention is chosen.
-- 6. Never trust client-supplied prices or totals. Calculate from database prices in PHP.
-- 7. Do not store card PAN/CVV or payment secrets. Verify signed provider webhooks and use idempotency.
-- 8. Restrict seller queries by authenticated seller_profiles.id; restrict admin operations server-side.
-- 9. The review trigger checks the buyer link but production logic must also verify that the item was delivered
--    and belongs to the reviewed product. Enforce that in the service layer or a stronger schema relation.
-- 10. Run this script against a disposable test database first and verify against your exact MySQL version.
