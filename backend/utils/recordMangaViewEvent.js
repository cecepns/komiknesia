const db = require('../db');

async function recordMangaViewEvent(mangaId) {
  if (mangaId == null || mangaId === '') return;
  try {
    await db.execute('INSERT INTO manga_view_events (manga_id) VALUES (?)', [mangaId]);
  } catch (e) {
    console.warn('recordMangaViewEvent failed:', e.message);
  }
}

module.exports = { recordMangaViewEvent };
