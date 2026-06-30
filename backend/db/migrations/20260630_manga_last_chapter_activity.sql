-- Denormalized last released chapter activity for fast GET /api/contents sorting.
-- MANUAL ONLY — jangan dijalankan saat traffic tinggi / lewat phpMyAdmin jam sibuk.
-- Jalankan per statement, tunggu selesai sebelum lanjut ke statement berikutnya.
-- Jika phpMyAdmin hang: buka tab SQL lain → SHOW PROCESSLIST → KILL <id>;

ALTER TABLE `manga`
  ADD COLUMN `last_chapter_activity_at` DATETIME NULL DEFAULT NULL AFTER `updated_at`,
  ALGORITHM=INPLACE, LOCK=NONE;

ALTER TABLE `manga`
  ADD INDEX `idx_manga_manual_last_activity` (`is_input_manual`, `last_chapter_activity_at`, `id`),
  ALGORITHM=INPLACE, LOCK=NONE;

ALTER TABLE `manga`
  ADD INDEX `idx_manga_project_last_activity` (`is_project`, `last_chapter_activity_at`, `id`),
  ALGORITHM=INPLACE, LOCK=NONE;

-- Index untuk fetch last chapters (opsional, jalankan terpisah jika belum ada):
-- ALTER TABLE `chapters`
--   ADD INDEX `idx_chapters_manga_number_created` (`manga_id`, `chapter_number`, `created_at`),
--   ALGORITHM=INPLACE, LOCK=NONE;

-- Backfill: gunakan script Node (batch kecil, tidak lock lama):
--   node backend/scripts/backfill-manga-last-chapter-activity.js
