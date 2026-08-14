-- SQL Migration file for adding default hero_banners key to settings table
-- Date: 2026-08-14

-- 1. Ensure `value` column in `settings` is TEXT (in case it hasn't been modified yet)
ALTER TABLE settings MODIFY COLUMN `value` TEXT NULL;

-- 2. Insert default empty array `hero_banners` JSON data into `settings` table
INSERT INTO settings (`key`, `value`)
VALUES (
  'hero_banners',
  '[]'
)
ON DUPLICATE KEY UPDATE `value` = `value`;
