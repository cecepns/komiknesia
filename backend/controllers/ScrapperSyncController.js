/* eslint-disable no-undef */
/* eslint-env node */
const db = require('../db');
const { refreshMangaChapterActivity } = require('../utils/chapterRelease');
const { invalidateContentsCaches } = require('./ContentsController');

const DEFAULT_SOURCE = 'scrapper';

function cleanText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function normalizeContentType(raw) {
  const normalized = cleanText(raw).toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('manhwa') || normalized.includes('webtoon')) return 'manhwa';
  if (normalized.includes('manhua')) return 'manhua';
  if (normalized.includes('comic')) return 'comic';
  if (normalized.includes('manga')) return 'manga';
  return null;
}

function normalizeChapterTitle(rawTitle, chapterNumber) {
  const t = cleanText(rawTitle);
  if (!t) return chapterNumber ? `Chapter ${chapterNumber}` : 'Chapter';
  const match = t.match(/chapter\s+([\d.]+)/i);
  if (match) return `Chapter ${match[1]}`;
  return t.split(/\s+\d+\s+\d+$/).shift() || t;
}

function buildLocalChapterSlug(mangaSlug, rawChapterSlug) {
  if (rawChapterSlug.startsWith(mangaSlug + '-')) {
    return rawChapterSlug;
  }
  return `${mangaSlug}-${rawChapterSlug}`;
}

async function getCategorySlugToIdMap() {
  const [rows] = await db.execute('SELECT id, slug FROM categories');
  const map = new Map();
  for (const r of rows) {
    if (!r.slug) continue;
    map.set(String(r.slug).toLowerCase(), r.id);
  }
  return map;
}

async function upsertMangaGenres(mangaId, genreSlugs) {
  const slugs = Array.from(
    new Set((genreSlugs || []).map((s) => String(s || '').toLowerCase()).filter(Boolean))
  );
  if (!slugs.length) {
    await db.execute('DELETE FROM manga_genres WHERE manga_id = ?', [mangaId]);
    return;
  }

  const slugToId = await getCategorySlugToIdMap();
  const categoryIds = slugs.map((s) => slugToId.get(s)).filter(Boolean);
  if (!categoryIds.length) {
    await db.execute('DELETE FROM manga_genres WHERE manga_id = ?', [mangaId]);
    return;
  }

  await db.execute(
    `DELETE FROM manga_genres WHERE manga_id = ? AND category_id NOT IN (${categoryIds.join(',')})`,
    [mangaId]
  );

  for (const categoryId of categoryIds) {
    const [exists] = await db.execute(
      'SELECT 1 FROM manga_genres WHERE manga_id = ? AND category_id = ? LIMIT 1',
      [mangaId, categoryId]
    );
    if (exists.length) continue;
    await db.execute('INSERT INTO manga_genres (manga_id, category_id) VALUES (?, ?)', [
      mangaId,
      categoryId,
    ]);
  }
}

const receiveScrapedData = async (req, res) => {
  try {
    const { source, mangaDetail, chapters } = req.body;

    if (!mangaDetail || !mangaDetail.slug) {
      return res.status(400).json({ status: false, error: 'mangaDetail is required and must contain slug' });
    }

    const SOURCE = source || DEFAULT_SOURCE;

    // 1. Upsert Manga
    let mangaId;
    let isCreated = false;
    const [existingManga] = await db.execute('SELECT * FROM manga WHERE slug = ? LIMIT 1', [mangaDetail.slug]);

    if (existingManga.length > 0) {
      const existing = existingManga[0];
      mangaId = existing.id;
      
      const setClauses = [];
      const values = [];

      if (!existing.is_input_manual) {
        setClauses.push('is_input_manual = ?');
        values.push(true);
      }
      
      const newAlternative = mangaDetail.alternativeName;
      if ((!existing.alternative_name || String(existing.alternative_name).trim() === '') && newAlternative) {
        setClauses.push('alternative_name = ?');
        values.push(newAlternative);
      }
      
      const newSynopsis = mangaDetail.synopsis;
      if ((!existing.synopsis || String(existing.synopsis).trim() === '') && newSynopsis) {
        setClauses.push('synopsis = ?');
        values.push(newSynopsis);
      }

      const newContentType = normalizeContentType(mangaDetail.contentType);
      const existingContentType = normalizeContentType(existing.content_type);
      if (newContentType && newContentType !== existingContentType) {
        setClauses.push('content_type = ?');
        values.push(newContentType);
      }

      if (mangaDetail.rating != null && Number.isFinite(Number(mangaDetail.rating)) && Number(mangaDetail.rating) > 0) {
        setClauses.push('rating = ?');
        values.push(Number(mangaDetail.rating));
      }

      if ((!existing.cover_background || String(existing.cover_background).trim() === '') && mangaDetail.coverImage) {
        setClauses.push('cover_background = ?');
        values.push(mangaDetail.coverImage); // Already R2 URL
      }

      if (setClauses.length > 0) {
        values.push(mangaId);
        await db.execute(`UPDATE manga SET ${setClauses.join(', ')} WHERE id = ?`, values);
      }

      if (Array.isArray(mangaDetail.genres) && mangaDetail.genres.length) {
        await upsertMangaGenres(mangaId, mangaDetail.genres);
      }

    } else {
      const [result] = await db.execute(
        `INSERT INTO manga (
          title, slug, author, synopsis, category_id, thumbnail, cover_background,
          alternative_name, content_type, country_id, \`release\`, status, rating, color, source, is_input_manual
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          mangaDetail.title,
          mangaDetail.slug,
          'Unknown',
          mangaDetail.synopsis || null,
          null,
          mangaDetail.coverImage || null,
          null,
          mangaDetail.alternativeName || null,
          mangaDetail.contentType || 'manga',
          null,
          null,
          'ongoing',
          mangaDetail.rating != null && Number.isFinite(Number(mangaDetail.rating)) && Number(mangaDetail.rating) > 0
            ? Number(mangaDetail.rating)
            : null,
          false,
          SOURCE,
          true,
        ]
      );
      mangaId = result.insertId;
      isCreated = true;

      if (Array.isArray(mangaDetail.genres) && mangaDetail.genres.length) {
        await upsertMangaGenres(mangaId, mangaDetail.genres);
      }
    }

    // 2. Upsert Chapters and Images
    let chaptersCreated = 0;
    let imagesInserted = 0;

    if (Array.isArray(chapters) && chapters.length > 0) {
      for (const ch of chapters) {
        const localSlug = buildLocalChapterSlug(mangaDetail.slug, ch.slug);
        const chapterTitle = normalizeChapterTitle(ch.title, ch.chapterNumber);
        const chapterNumber = ch.chapterNumber !== null && ch.chapterNumber !== undefined ? String(ch.chapterNumber) : null;

        let [existingCh] = await db.execute('SELECT id FROM chapters WHERE slug = ? LIMIT 1', [localSlug]);

        if (!existingCh.length && chapterNumber !== null) {
          [existingCh] = await db.execute(
            'SELECT id FROM chapters WHERE manga_id = ? AND chapter_number = ? LIMIT 1',
            [mangaId, chapterNumber]
          );
        }

        let chapterId;
        if (existingCh.length) {
          chapterId = existingCh[0].id;
          await db.execute(
            'UPDATE chapters SET title = ?, chapter_number = ?, slug = ? WHERE id = ?',
            [chapterTitle, chapterNumber, localSlug, chapterId]
          );
        } else {
          const [resCh] = await db.execute(
            'INSERT INTO chapters (manga_id, title, chapter_number, slug, cover) VALUES (?, ?, ?, ?, ?)',
            [mangaId, chapterTitle, chapterNumber, localSlug, null]
          );
          chapterId = resCh.insertId;
          chaptersCreated++;
        }

        // Upsert images
        if (Array.isArray(ch.images) && ch.images.length > 0) {
           await db.execute('DELETE FROM chapter_images WHERE chapter_id = ?', [chapterId]);
           for (let i = 0; i < ch.images.length; i++) {
             await db.execute(
               'INSERT INTO chapter_images (chapter_id, image_path, page_number) VALUES (?, ?, ?)',
               [chapterId, ch.images[i], i + 1]
             );
             imagesInserted++;
           }
        }
      }

      await refreshMangaChapterActivity(db, mangaId);
      invalidateContentsCaches();
    }

    res.json({
      status: true,
      message: 'Scraped data saved successfully',
      data: {
        mangaId,
        mangaSlug: mangaDetail.slug,
        isCreated,
        chaptersCreated,
        imagesInserted
      }
    });

  } catch (error) {
    console.error('Error in ScrapperSyncController:', error);
    res.status(500).json({ status: false, error: error.message });
  }
};

module.exports = {
  receiveScrapedData
};
