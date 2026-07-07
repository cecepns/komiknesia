-- Allow email column to be NULL (optional during registration)
-- This fixes "Column 'email' cannot be null" error when registering without email

ALTER TABLE `users`
  MODIFY COLUMN `email` VARCHAR(255) NULL DEFAULT NULL;
