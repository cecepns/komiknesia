-- Migration: Add membership_type to users table (web, mobile, both)
ALTER TABLE users 
  ADD COLUMN membership_type VARCHAR(20) NOT NULL DEFAULT 'web';
