-- JANGAN jalankan file ini sekaligus di phpMyAdmin — bisa lock tabel manga/chapters lama.
-- Gunakan script Node ber-batch:
--   node backend/scripts/backfill-manga-last-chapter-activity.js
--
-- Atau batch manual (500 baris per run, ulangi sampai affected rows = 0):

UPDATE manga m
INNER JOIN (
  SELECT manga_id, MAX(COALESCE(scheduled_release_at, created_at)) AS activity_at
  FROM chapters
  WHERE scheduled_release_at IS NULL OR scheduled_release_at <= NOW()
  GROUP BY manga_id
) lc ON lc.manga_id = m.id
SET m.last_chapter_activity_at = lc.activity_at
WHERE m.last_chapter_activity_at IS NULL
LIMIT 500;
