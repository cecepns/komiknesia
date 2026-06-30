-- Indexes for GET /api/contents (genre filter + chapters last-activity subquery).
-- Run once in phpMyAdmin / mysql CLI against production DB.
-- If you see "Duplicate key name", that index already exists — skip that statement.
--
-- Also run:
--   backend/db/migrations/20260630_manga_last_chapter_activity.sql
--   backend/scripts/backfill-manga-last-chapter-activity.sql

ALTER TABLE `chapters`
  ADD INDEX `idx_chapters_manga_activity` (`manga_id`, `updated_at`, `created_at`);

ALTER TABLE `chapters`
  ADD INDEX `idx_chapters_manga_number_created` (`manga_id`, `chapter_number`, `created_at`);

ALTER TABLE `manga_genres`
  ADD INDEX `idx_manga_genres_manga_category` (`manga_id`, `category_id`);

ALTER TABLE `manga`
  ADD INDEX `idx_manga_input_manual_activity` (`is_input_manual`, `updated_at`, `created_at`, `id`);
