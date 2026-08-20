-- Tambah kolom cover pada tabel chapters untuk menyimpan cover / thumbnail kustom chapter
-- Run on MySQL if migrations are not auto-applied.

ALTER TABLE chapters ADD COLUMN cover VARCHAR(500) NULL AFTER slug;
