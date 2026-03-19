-- Adds uniqueness guards for chapter/image sync idempotency.
-- Safe to run once; will fail if indexes already exist.

ALTER TABLE `chapters`
  ADD UNIQUE KEY `unique_chapter_slug` (`slug`);

ALTER TABLE `chapter_images`
  ADD UNIQUE KEY `unique_chapter_page` (`chapter_id`, `page_number`),
  ADD UNIQUE KEY `unique_chapter_image_path` (`chapter_id`, `image_path`);

-- ALTER TABLE `chapter_images` DROP INDEX `unique_chapter_page`;
-- ALTER TABLE `chapter_images` DROP INDEX `unique_chapter_image_path`;

-- ALTER TABLE `chapter_images`
--   ADD UNIQUE KEY `unique_chapter_page` (`chapter_id`, `page_number`),
--   ADD UNIQUE KEY `unique_chapter_image_path` (`chapter_id`, `image_path`);