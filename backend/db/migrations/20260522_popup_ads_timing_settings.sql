-- Popup iklan (AdPopup): jeda pertama & durasi no-skip — dikelola dari admin.
-- Run manually on MySQL jika migration tidak dijalankan otomatis.
-- Aman dijalankan ulang: baris yang sudah ada tidak menimpa nilai yang sudah diset admin.

INSERT INTO settings (`key`, `value`)
VALUES
  ('popup_ads_initial_delay_minutes', '5'),
  ('popup_ads_unlock_seconds', '10')
ON DUPLICATE KEY UPDATE `value` = `value`;
