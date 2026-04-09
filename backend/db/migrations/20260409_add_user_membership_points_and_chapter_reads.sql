ALTER TABLE users
  ADD COLUMN points INT NOT NULL DEFAULT 0,
  ADD COLUMN is_membership TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN membership_expires_at DATETIME NULL;

CREATE TABLE IF NOT EXISTS user_chapter_reads (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  chapter_id INT NOT NULL,
  exp_awarded INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_user_chapter_read (user_id, chapter_id),
  KEY idx_user_chapter_reads_user (user_id),
  KEY idx_user_chapter_reads_chapter (chapter_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
