-- Migration: Create email_otps table for OTP verification (Register & Reset Password)
-- Date: 2026-08-26

CREATE TABLE IF NOT EXISTS email_otps (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(191) NOT NULL,
  otp_code VARCHAR(10) NOT NULL,
  purpose ENUM('register', 'reset_password') NOT NULL,
  payload TEXT NULL,
  expires_at DATETIME NOT NULL,
  is_used TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_email_otps_lookup (email, purpose, is_used, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
