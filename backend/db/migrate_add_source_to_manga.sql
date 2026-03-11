-- Add source column to manga table for tracking content origin
-- Safe to run multiple times thanks to IF NOT EXISTS
ALTER TABLE `manga`
  ADD COLUMN IF NOT EXISTS `source` VARCHAR(50) DEFAULT NULL AFTER `westmanga_id`;

