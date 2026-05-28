-- Per-manga view events for time-window popularity (harian / mingguan / bulanan).
CREATE TABLE IF NOT EXISTS manga_view_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  manga_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_mve_manga_created (manga_id, created_at),
  KEY idx_mve_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
