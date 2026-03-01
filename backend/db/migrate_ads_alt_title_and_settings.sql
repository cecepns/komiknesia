-- Add image_alt and title to ads for dynamic alt/title per ad (run once; ignore error if columns exist)
ALTER TABLE `ads` ADD COLUMN `image_alt` VARCHAR(500) DEFAULT NULL AFTER `ads_type`;
ALTER TABLE `ads` ADD COLUMN `title` VARCHAR(500) DEFAULT NULL AFTER `image_alt`;

-- Settings table for popup intervals (10, 15, 20, ..., 60 minutes)
CREATE TABLE IF NOT EXISTS `settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `key` varchar(100) NOT NULL,
  `value` varchar(255) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `settings` (`key`, `value`) VALUES
  ('popup_ads_interval_minutes', '20'),
  ('home_popup_interval_minutes', '30')
ON DUPLICATE KEY UPDATE `key` = `key`;
