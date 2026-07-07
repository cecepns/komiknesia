-- Insert default cdn_domain setting
INSERT INTO settings (`key`, `value`) 
VALUES ('cdn_domain', 'https://cdn.komiknesia.net') 
ON DUPLICATE KEY UPDATE `value` = `value`;

-- Convert existing absolute R2/S3 URLs in manga table to relative keys
UPDATE manga 
SET thumbnail = SUBSTRING(thumbnail, LOCATE('komiknesia/', thumbnail))
WHERE thumbnail LIKE '%komiknesia/%';

-- Convert existing absolute R2/S3 URLs in chapter_images table to relative keys
UPDATE chapter_images
SET image_path = SUBSTRING(image_path, LOCATE('komiknesia/', image_path))
WHERE image_path LIKE '%komiknesia/%';
