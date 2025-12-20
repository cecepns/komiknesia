-- Insert admin user
-- Password: @backend/uploads-komiknesia/image-1766231072205-953873386.jpg
-- 
-- IMPORTANT: 
-- 1. First, generate the bcrypt hash by running: node backend/generate-admin-hash.js
-- 2. Copy the generated hash and replace the placeholder hash below
-- 3. Then run this migration

-- Ensure password column exists (handle both password and password_hash columns)
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'users' 
  AND COLUMN_NAME = 'password';

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE users ADD COLUMN password VARCHAR(255) AFTER password_hash',
  'SELECT "password column already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Copy password_hash to password if password is empty
UPDATE users SET password = password_hash WHERE (password IS NULL OR password = '') AND password_hash IS NOT NULL;

-- Insert admin user
-- Replace the hash below with the bcrypt hash from generate-admin-hash.js
-- Example hash format: $2a$10$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
INSERT INTO users (username, email, password, role, is_active) 
VALUES (
  'admin',
  'admin@gmail.com',
  '@backend/uploads-komiknesia/image-1766231072205-953873386.jpg', -- TODO: Replace with bcrypt hash from generate-admin-hash.js
  'admin',
  TRUE
)
ON DUPLICATE KEY UPDATE
  email = VALUES(email),
  password = VALUES(password),
  role = VALUES(role),
  is_active = VALUES(is_active);

