-- Migration: Add target_platform, media_type, and video_url to ads table
ALTER TABLE ads 
  ADD COLUMN target_platform VARCHAR(20) NOT NULL DEFAULT 'web',
  ADD COLUMN media_type VARCHAR(20) NOT NULL DEFAULT 'image',
  ADD COLUMN video_url VARCHAR(500) NULL;
