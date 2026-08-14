-- SQL Migration file for adding default quick_links to settings table
-- Date: 2026-08-14

-- 1. Ensure `value` column in `settings` is TEXT (in case it hasn't been modified yet)
ALTER TABLE settings MODIFY COLUMN `value` TEXT NULL;

-- 2. Insert default `quick_links` JSON data into `settings` table
INSERT INTO settings (`key`, `value`)
VALUES (
  'quick_links',
  '[{"id":"read_manga","title":"Baca Manga","subtitle":"Ribuan judul manga, manhwa & manhua gratis","href":"https://v1.komiknesiaku.com/","icon":"BookOpen","badge":"Hot","is_active":true,"is_internal":false},{"id":"premium","title":"Upgrade ke Premium","subtitle":"Baca tanpa iklan & fitur eksklusif","href":"https://v1.komiknesiaku.com/premium","icon":"Crown","is_active":true,"is_internal":false},{"id":"discord","title":"Join Discord","subtitle":"Komunitas pembaca & update info terbaru","href":"https://discord.gg/dgC22PSm9h","icon":"Discord","is_active":true,"is_internal":false},{"id":"facebook","title":"Facebook","subtitle":"Halaman resmi KomikNesia di Facebook","href":"https://facebook.com","icon":"Facebook","is_active":true,"is_internal":false},{"id":"tiktok","title":"TikTok","subtitle":"Follow TikTok KomikNesia","href":"https://tiktok.com","icon":"TikTok","is_active":true,"is_internal":false},{"id":"instagram","title":"Instagram","subtitle":"Follow Instagram KomikNesia","href":"https://instagram.com","icon":"Instagram","is_active":true,"is_internal":false},{"id":"download_app","title":"Download App","subtitle":"Baca manga lebih nyaman di aplikasi","href":"https://02.komiknesia.asia/","icon":"Download","is_active":true,"is_internal":false}]'
)
ON DUPLICATE KEY UPDATE `value` = `value`;
