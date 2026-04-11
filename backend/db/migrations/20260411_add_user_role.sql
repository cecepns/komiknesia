ALTER TABLE users
  ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT 'user';

-- Akun admin utama (sesuai data produksi / pengujian)
UPDATE users SET role = 'admin' WHERE id = 1 OR LOWER(TRIM(COALESCE(email, ''))) = 'admin@gmail.com';
