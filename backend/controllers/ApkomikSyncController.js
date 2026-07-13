/* eslint-disable no-undef */
/* eslint-env node */
const db = require('../db');
const axios = require('axios');
const cheerio = require('cheerio');
const { uploadUrlToS3 } = require('../utils/s3Upload');
const { refreshMangaChapterActivity } = require('../utils/chapterRelease');
const { invalidateContentsCaches } = require('./ContentsController');
const path = require('path');

const BASE_URL = 'https://01.apkomik.com';
const SOURCE = 'apkomik';
const MANGA_PATH_REGEX = /\/manga\/([^/?#]+)/i;

const DEFAULT_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

let _categoriesCache = null;
let _categoriesCacheAt = 0;
const CATEGORIES_CACHE_TTL_MS = 5 * 60 * 1000;

function cleanText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
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

async function fetchHtml(url) {
  const headers = {
    'User-Agent': DEFAULT_UA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  try {
    const res = await axios.get(url, { headers, timeout: 25000 });
    return cheerio.load(res.data);
  } catch (error) {
    console.error(`Error fetching ${url}:`, error.message);
    throw new Error('Gagal mengambil data dari sumber apkomik');
  }
}

async function getCategorySlugToIdMap() {
  const now = Date.now();
  if (_categoriesCache && now - _categoriesCacheAt < CATEGORIES_CACHE_TTL_MS) {
    return _categoriesCache;
  }

  const [rows] = await db.execute('SELECT id, slug FROM categories');
  const map = new Map();
  for (const r of rows) {
    if (!r.slug) continue;
    map.set(String(r.slug).toLowerCase(), r.id);
  }
  _categoriesCache = map;
  _categoriesCacheAt = now;
  return map;
}

function slugifyGenre(text) {
  return cleanText(text)
    .toLowerCase()
    .replace(/[’'".]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function upsertMangaGenres(mangaId, genreSlugs) {
  const slugs = Array.from(
    new Set((genreSlugs || []).map((s) => String(s || '').toLowerCase()).filter(Boolean))
  );
  if (!slugs.length) {
    // If no genres are provided, clear all genres for this manga
    await db.execute('DELETE FROM manga_genres WHERE manga_id = ?', [mangaId]);
    return { matched: 0, inserted: 0 };
  }

  const slugToId = await getCategorySlugToIdMap();
  const categoryIds = slugs.map((s) => slugToId.get(s)).filter(Boolean);
  if (!categoryIds.length) {
    await db.execute('DELETE FROM manga_genres WHERE manga_id = ?', [mangaId]);
    return { matched: 0, inserted: 0 };
  }

  // Delete genres that are not in the new list for this manga
  await db.execute(
    `DELETE FROM manga_genres WHERE manga_id = ? AND category_id NOT IN (${categoryIds.join(',')})`,
    [mangaId]
  );

  let inserted = 0;
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
    inserted += 1;
  }

  return { matched: categoryIds.length, inserted };
}

function resolveMangaTarget(rawValue, fallbackBaseUrl = BASE_URL) {
  const raw = String(rawValue || '').trim();
  if (!raw) {
    return { slug: '', baseUrl: fallbackBaseUrl, url: null };
  }

  try {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      const parsed = new URL(raw);
      const match = parsed.pathname.match(MANGA_PATH_REGEX);
      const slug = String(match?.[1] || '').replace(/\/$/, '').trim();
      return {
        slug,
        baseUrl: `${parsed.protocol}//${parsed.host}`,
        url: slug ? `${parsed.protocol}//${parsed.host}/manga/${slug}/` : parsed.toString(),
      };
    }
  } catch {
    // Fall through
  }

  const pathMatch = raw.match(MANGA_PATH_REGEX);
  if (pathMatch?.[1]) {
    const slug = String(pathMatch[1]).replace(/\/$/, '').trim();
    return {
      slug,
      baseUrl: fallbackBaseUrl,
      url: `${fallbackBaseUrl}/manga/${slug}/`,
    };
  }

  const slug = raw
    .replace(/^\/+|\/+$/g, '')
    .replace(/^manga\//i, '')
    .trim();

  return {
    slug,
    baseUrl: fallbackBaseUrl,
    url: slug ? `${fallbackBaseUrl}/manga/${slug}/` : null,
  };
}

async function scrapeFeed(type, { page = 1 } = {}) {
  let pathStr = '';
  if (type === 'manhua') pathStr = '/manhua-terbaru/';
  else if (type === 'manhwa') pathStr = '/manhwa-terbaru/';
  else pathStr = '/manga-terbaru/';

  const normalizedPage = parseInt(page, 10) || 1;
  let url = '';
  if (normalizedPage > 1) {
    url = `${BASE_URL}${pathStr}page/${normalizedPage}/`;
  } else {
    url = `${BASE_URL}${pathStr}`;
  }

  const $ = await fetchHtml(url);
  const mangaMap = new Map();

  $('.listupd .bsx').each((_, el) => {
    const item = $(el);
    const linkEl = item.find('a').first();
    const href = linkEl.attr('href') || '';
    if (!href.includes('/manga/')) return;

    const target = resolveMangaTarget(href, BASE_URL);
    const slug = target.slug;
    if (!slug) return;

    let title = cleanText(linkEl.attr('title') || item.find('.tt').text() || slug.replace(/-/g, ' '));
    
    const imgEl = item.find('img').first();
    let coverImage = null;
    if (imgEl.length) {
      let src = imgEl.attr('src') || imgEl.attr('data-src');
      if (src) {
        if (src.startsWith('//')) src = 'https:' + src;
        else if (src.startsWith('/')) src = BASE_URL + src;
        coverImage = src;
      }
    }

    if (!mangaMap.has(slug)) {
      mangaMap.set(slug, { slug, title, url: target.url, coverImage });
    } else {
      const existing = mangaMap.get(slug);
      if (!existing.coverImage && coverImage) existing.coverImage = coverImage;
      if ((!existing.title || existing.title === slug.replace(/-/g, ' ')) && title) {
        existing.title = title;
      }
    }
  });

  return Array.from(mangaMap.values());
}

async function scrapeMangaDetail(slug, { baseUrl = BASE_URL } = {}) {
  const mangaUrl = `${baseUrl}/manga/${slug}/`;
  const $ = await fetchHtml(mangaUrl);

  const title =
    cleanText($('.entry-title').first().text()) ||
    cleanText($('h1').first().text()) ||
    slug.replace(/-/g, ' ');

  let alternativeName = '';
  $('.wd-full').each((_, el) => {
    const bText = $(el).find('b').text().trim();
    if (bText.toLowerCase().includes('alternative')) {
      alternativeName = cleanText($(el).find('span').text());
    }
  });

  let coverImage = null;
  const coverImgEl = $('.thumb img').first();
  if (coverImgEl.length) {
    let src = coverImgEl.attr('src') || coverImgEl.attr('data-src');
    if (src) {
      if (src.startsWith('//')) src = 'https:' + src;
      else if (src.startsWith('/')) src = baseUrl + src;
      coverImage = src;
    }
  }

  let synopsis = cleanText($('.entry-content p, [itemprop="description"] p').text()) ||
                 cleanText($('.entry-content, [itemprop="description"]').text());

  const genres = new Set();
  $('.mgen a').each((_, el) => {
    const txt = cleanText($(el).text());
    const gSlug = slugifyGenre(txt);
    if (gSlug) genres.add(gSlug);
  });

  let rating = null;
  const ratingText = $('.numrating').text().trim() || $('.rating-prc .num').text().trim();
  if (ratingText) {
    const parsedRating = parseFloat(ratingText);
    if (Number.isFinite(parsedRating) && parsedRating > 0) {
      rating = parsedRating;
    }
  }

  let contentType = 'manga';
  $('.imptdt, .tsinfo, .info-cast, .info-post').each((_, el) => {
    const text = $(el).text().toLowerCase();
    if (text.includes('type') || text.includes('tipe')) {
      if (text.includes('manhwa')) contentType = 'manhwa';
      else if (text.includes('manhua')) contentType = 'manhua';
      else if (text.includes('manga')) contentType = 'manga';
      else if (text.includes('comic')) contentType = 'comic';
    }
  });

  const chapters = [];
  $('#chapterlist ul li, .cl ul li').each((_, el) => {
    const item = $(el);
    const linkEl = item.find('a').first();
    const href = linkEl.attr('href') || '';
    if (!href) return;

    const fullUrl = href.startsWith('http') ? href : baseUrl + href.replace(/^\//, '');
    const chapterSlug = href.split('/').filter(Boolean).pop();

    const titleText = linkEl.find('.chapternum').text().trim() || linkEl.text().trim();
    
    let chapterNumber = null;
    const numMatch =
      chapterSlug.match(/chapter-([\d.]+)/i) ||
      titleText.match(/chapter\s+([\d.]+)/i) ||
      titleText.match(/ch\.\s*([\d.]+)/i) ||
      titleText.match(/([\d.]+)/);
    if (numMatch) {
      chapterNumber = parseFloat(numMatch[1]);
    }

    chapters.push({
      title: titleText || chapterSlug,
      url: fullUrl,
      slug: chapterSlug,
      chapterNumber,
    });
  });

  return {
    slug,
    url: mangaUrl,
    title,
    coverImage,
    alternativeName: alternativeName || null,
    synopsis,
    genres: Array.from(genres),
    chapters,
    rating,
    contentType,
  };
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

async function getMangaBySlugLocal(slug) {
  const [rows] = await db.execute('SELECT * FROM manga WHERE slug = ? LIMIT 1', [slug]);
  return rows[0] || null;
}

async function upsertMangaFromApkomik(detail, { saveToS3 = false } = {}) {
  const existing = await getMangaBySlugLocal(detail.slug);
  if (existing) {
    if (!existing.is_input_manual) {
      await db.execute('UPDATE manga SET is_input_manual = TRUE WHERE id = ?', [existing.id]);
    }
    if (existing.source !== SOURCE) {
      await db.execute('UPDATE manga SET source = ? WHERE id = ?', [SOURCE, existing.id]);
    }
    if (Array.isArray(detail.genres) && detail.genres.length) {
      await upsertMangaGenres(existing.id, detail.genres);
    }

    const shouldUpdateAlternative =
      (!existing.alternative_name || String(existing.alternative_name).trim() === '') &&
      detail.alternativeName;
    const shouldUpdateSynopsis =
      (!existing.synopsis || String(existing.synopsis).trim() === '') && detail.synopsis;
    const normalizedExistingType = normalizeContentType(existing.content_type);
    const shouldUpdateContentType =
      !!detail.contentType && detail.contentType !== normalizedExistingType;

    if (shouldUpdateAlternative || shouldUpdateSynopsis || shouldUpdateContentType) {
      const setClauses = [];
      const values = [];
      if (shouldUpdateAlternative) {
        setClauses.push('alternative_name = ?');
        values.push(detail.alternativeName);
      }
      if (shouldUpdateSynopsis) {
        setClauses.push('synopsis = ?');
        values.push(detail.synopsis || null);
      }
      if (shouldUpdateContentType) {
        setClauses.push('content_type = ?');
        values.push(detail.contentType);
      }
      values.push(existing.id);

      await db.execute(`UPDATE manga SET ${setClauses.join(', ')} WHERE id = ?`, values);
    }

    if (detail.rating != null && Number.isFinite(Number(detail.rating)) && Number(detail.rating) > 0) {
      await db.execute('UPDATE manga SET rating = ? WHERE id = ?', [Number(detail.rating), existing.id]);
    }

    const shouldBackfillCover =
      (!existing.cover_background || String(existing.cover_background).trim() === '') && detail.coverImage;
    if (shouldBackfillCover) {
      let coverUrl = detail.coverImage;
      if (saveToS3) {
        const extFromUrl = (() => {
          try {
            const clean = String(detail.coverImage).split('?')[0];
            return path.extname(clean);
          } catch {
            return '';
          }
        })();
        const ext = extFromUrl || '.webp';
        const key = `komiknesia/apkomik/manga/${detail.slug}/cover${ext}`;
        try {
          coverUrl = await uploadUrlToS3(key, detail.coverImage);
        } catch (e) {
          console.error('S3 upload cover failed:', e.message);
          coverUrl = detail.coverImage;
        }
      }

      await db.execute('UPDATE manga SET cover_background = ? WHERE id = ?', [coverUrl, existing.id]);
    }
    return { mangaId: existing.id, created: false };
  }

  let coverUrl = null;
  if (detail.coverImage) {
    const extFromUrl = (() => {
      try {
        const clean = String(detail.coverImage).split('?')[0];
        return path.extname(clean);
      } catch {
        return '';
      }
    })();
    const ext = extFromUrl || '.webp';
    if (saveToS3) {
      const key = `komiknesia/apkomik/manga/${detail.slug}/cover${ext}`;
      coverUrl = detail.coverImage;
      try {
        coverUrl = await uploadUrlToS3(key, detail.coverImage);
      } catch (e) {
        console.error('S3 upload cover failed:', e.message);
        coverUrl = detail.coverImage;
      }
    } else {
      coverUrl = detail.coverImage;
    }
  }

  const [result] = await db.execute(
    `
      INSERT INTO manga (
        title, slug, author, synopsis, category_id, thumbnail, cover_background,
        alternative_name, content_type, country_id, \`release\`, status, rating, color, source, is_input_manual
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      detail.title,
      detail.slug,
      'Unknown',
      detail.synopsis || null,
      null,
      coverUrl,
      null,
      detail.alternativeName || null,
      detail.contentType || 'manga',
      null,
      null,
      'ongoing',
      detail.rating != null &&
        Number.isFinite(Number(detail.rating)) &&
        Number(detail.rating) > 0
        ? Number(detail.rating)
        : null,
      false,
      SOURCE,
      true,
    ]
  );

  if (Array.isArray(detail.genres) && detail.genres.length) {
    await upsertMangaGenres(result.insertId, detail.genres);
  }

  return { mangaId: result.insertId, created: true };
}

async function scrapeChapterImages(mangaSlug, chapterSlug, { baseUrl = BASE_URL } = {}) {
  const chapterUrl = chapterSlug.startsWith('http') ? chapterSlug : `${baseUrl}/${chapterSlug.replace(/^\//, '')}/`;
  const $ = await fetchHtml(chapterUrl);
  const images = [];
  const seen = new Set();

  $('script').each((_, el) => {
    const text = $(el).text();
    if (text.includes('ts_reader.run')) {
      const match = text.match(/ts_reader\.run\((.*?)\);/);
      if (match && match[1]) {
        try {
          const data = JSON.parse(match[1]);
          if (data.sources && data.sources[0] && data.sources[0].images) {
            const rawImages = data.sources[0].images;
            for (let src of rawImages) {
              src = String(src).trim();
              if (!src) continue;
              if (src.startsWith('//')) src = 'https:' + src;
              else if (src.startsWith('/')) src = baseUrl + src;
              
              if (seen.has(src)) continue;
              seen.add(src);
              images.push(src);
            }
          }
        } catch (e) {
          console.error('Failed parsing ts_reader json:', e);
        }
      }
    }
  });

  if (images.length === 0) {
    $('#readerarea img').each((_, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src');
      if (!src) return;
      if (src.startsWith('//')) src = 'https:' + src;
      else if (src.startsWith('/')) src = baseUrl + src;
      src = src.trim();
      if (seen.has(src)) return;
      seen.add(src);
      images.push(src);
    });
  }

  return { url: chapterUrl, images };
}

function normalizeImageUrlForCompare(url) {
  if (url == null) return '';
  const s = String(url).trim();
  if (!s) return '';
  try {
    const href = s.startsWith('//') ? `https:${s}` : s;
    const u = new URL(href);
    let out = `${u.protocol}//${u.host}${u.pathname}`.toLowerCase();
    out = out.replace(/\/+$/, '');
    return out;
  } catch {
    return s.split('?')[0].toLowerCase().trim();
  }
}

async function upsertChapterImages(chapterId, imageUrls, { saveToS3 = false } = {}) {
  const [existingRows] = await db.execute(
    'SELECT image_path, page_number FROM chapter_images WHERE chapter_id = ?',
    [chapterId]
  );
  const existingByPage = new Map();
  for (const r of existingRows) {
    const pn = Number(r.page_number);
    if (!Number.isFinite(pn) || pn < 1) continue;
    existingByPage.set(pn, r.image_path);
  }
  let inserted = 0;

  for (let i = 0; i < imageUrls.length; i++) {
    const page = i + 1;
    const url = imageUrls[i];

    let storedUrl = url;
    const extFromUrl = (() => {
      try {
        const clean = String(url).split('?')[0];
        return path.extname(clean);
      } catch {
        return '';
      }
    })();
    const ext = extFromUrl || '.webp';

    if (saveToS3) {
      const key = `komiknesia/apkomik/chapters/${chapterId}/pages/${page}${ext}`;
      try {
        storedUrl = await uploadUrlToS3(key, url);
      } catch (e) {
        console.error('S3 upload chapter image failed:', e.message);
        storedUrl = url;
      }
    }

    const prevPath = existingByPage.get(page);
    const hasRow = existingByPage.has(page);
    const hasRealPath = hasRow && prevPath != null && String(prevPath).trim() !== '';

    if (hasRealPath) {
      if (normalizeImageUrlForCompare(prevPath) === normalizeImageUrlForCompare(storedUrl)) {
        continue;
      }
      await db.execute(
        'UPDATE chapter_images SET image_path = ? WHERE chapter_id = ? AND page_number = ?',
        [storedUrl, chapterId, page]
      );
      existingByPage.set(page, storedUrl);
      inserted += 1;
      continue;
    }

    if (hasRow && !hasRealPath) {
      await db.execute(
        'UPDATE chapter_images SET image_path = ? WHERE chapter_id = ? AND page_number = ?',
        [storedUrl, chapterId, page]
      );
    } else {
      await db.execute(
        'INSERT INTO chapter_images (chapter_id, image_path, page_number) VALUES (?, ?, ?)',
        [chapterId, storedUrl, page]
      );
    }
    existingByPage.set(page, storedUrl);
    inserted += 1;
  }
  return inserted;
}

async function findLocalChapterIdBySlug(chapterSlug) {
  const [rows] = await db.execute('SELECT id FROM chapters WHERE slug = ? LIMIT 1', [chapterSlug]);
  return rows[0]?.id || null;
}

function parseBooleanFlag(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'boolean') return value;
  const str = String(value).toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(str)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(str)) return false;
  return defaultValue;
}

function parseNonNegativeInt(value, defaultValue = 0) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return defaultValue;
  return n;
}

function parsePositiveInt(value, defaultValue) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return defaultValue;
  return n;
}

async function getExistingChapterSlugSet(mangaId) {
  const [rows] = await db.execute('SELECT slug FROM chapters WHERE manga_id = ?', [mangaId]);
  return new Set(rows.map((r) => r.slug));
}

async function insertChaptersIfMissing(manga, apkomikChapters, { mode }) {
  const [existingRows] = await db.execute(
    'SELECT slug, chapter_number FROM chapters WHERE manga_id = ?',
    [manga.id]
  );

  const existingSlugs = new Set();
  const existingNumbers = new Set();
  for (const r of existingRows) {
    if (r.slug) existingSlugs.add(r.slug.toLowerCase());
    if (r.chapter_number !== null && r.chapter_number !== undefined) {
      const num = parseFloat(r.chapter_number);
      if (!isNaN(num)) {
        existingNumbers.add(num);
      }
    }
  }

  let inserted = 0;
  let skipped = 0;
  const insertedSlugs = [];

  const chaptersToProcess =
    mode === 'latestOnly' ? (apkomikChapters.length ? [apkomikChapters[0]] : []) : apkomikChapters;

  for (const ch of chaptersToProcess) {
    const localSlug = buildLocalChapterSlug(manga.slug, ch.slug);
    const chNum = ch.chapterNumber !== null && ch.chapterNumber !== undefined ? parseFloat(ch.chapterNumber) : null;

    const isDuplicateSlug = existingSlugs.has(localSlug.toLowerCase());
    const isDuplicateNumber = chNum !== null && !isNaN(chNum) ? existingNumbers.has(chNum) : false;

    if (isDuplicateSlug || isDuplicateNumber) {
      skipped += 1;
      continue;
    }

    const chapterTitle = normalizeChapterTitle(ch.title, ch.chapterNumber);
    const chapterNumber = ch.chapterNumber !== null && ch.chapterNumber !== undefined ? String(ch.chapterNumber) : null;

    await db.execute(
      'INSERT INTO chapters (manga_id, title, chapter_number, slug, cover) VALUES (?, ?, ?, ?, ?)',
      [manga.id, chapterTitle, chapterNumber, localSlug, null]
    );
    inserted += 1;
    insertedSlugs.push(localSlug);

    existingSlugs.add(localSlug.toLowerCase());
    if (chNum !== null && !isNaN(chNum)) {
      existingNumbers.add(chNum);
    }
  }

  if (inserted > 0) {
    await refreshMangaChapterActivity(db, manga.id);
    invalidateContentsCaches();
  }

  return { inserted, skipped, insertedSlugs };
}

async function upsertChapterFromApkomik(mangaId, mangaSlug, ch) {
  const localSlug = buildLocalChapterSlug(mangaSlug, ch.slug);
  const chapterTitle = normalizeChapterTitle(ch.title, ch.chapterNumber);
  const chapterNumber =
    ch.chapterNumber !== null && ch.chapterNumber !== undefined ? String(ch.chapterNumber) : null;

  let [existing] = await db.execute(
    'SELECT id, manga_id FROM chapters WHERE slug = ? LIMIT 1',
    [localSlug]
  );

  if (!existing.length && chapterNumber !== null) {
    [existing] = await db.execute(
      'SELECT id, manga_id FROM chapters WHERE manga_id = ? AND chapter_number = ? LIMIT 1',
      [mangaId, chapterNumber]
    );
  }

  if (existing.length) {
    const row = existing[0];
    await db.execute(
      'UPDATE chapters SET manga_id = ?, title = ?, chapter_number = ?, slug = ? WHERE id = ?',
      [mangaId, chapterTitle, chapterNumber, localSlug, row.id]
    );
    await refreshMangaChapterActivity(db, mangaId);
    invalidateContentsCaches();
    return { chapterId: row.id, created: false, slug: localSlug };
  }

  const [result] = await db.execute(
    'INSERT INTO chapters (manga_id, title, chapter_number, slug, cover) VALUES (?, ?, ?, ?, ?)',
    [mangaId, chapterTitle, chapterNumber, localSlug, null]
  );

  await refreshMangaChapterActivity(db, mangaId);
  invalidateContentsCaches();

  return { chapterId: result.insertId, created: true, slug: localSlug };
}

const listFeed = async (req, res) => {
  try {
    const type = String(req.query?.type || 'manga').toLowerCase();
    const page = parseInt(req.query?.page, 10) || 1;

    const feed = await scrapeFeed(type, { page });

    res.json({
      status: true,
      source: SOURCE,
      type,
      page,
      count: feed.length,
      data: feed,
    });
  } catch (e) {
    res.status(500).json({ status: false, error: e.message || 'Internal server error' });
  }
};

const syncSelected = async (req, res) => {
  try {
    const slugs = Array.isArray(req.body?.slugs) ? req.body.slugs : [];
    const uniqueSlugs = Array.from(
      new Set(slugs.map((s) => String(s || '').trim()).filter(Boolean))
    );

    if (!uniqueSlugs.length) {
      return res.status(400).json({
        status: false,
        error: 'Body wajib berisi slugs: string[]',
      });
    }

    const mode = req.body?.mode === 'full' ? 'full' : 'delta';
    const withImages = parseBooleanFlag(req.body?.withImages, false);
    const saveToS3 = parseBooleanFlag(req.body?.saveToS3, false);

    const summary = {
      requested: uniqueSlugs.length,
      mangaCreated: 0,
      mangaUpdated: 0,
      chaptersCreated: 0,
      imagesInserted: 0,
      errors: 0,
    };

    const results = [];

    for (const slug of uniqueSlugs) {
      try {
        const target = resolveMangaTarget(slug, BASE_URL);
        if (!target.slug) {
          throw new Error('Invalid manga slug');
        }
        const detail = await scrapeMangaDetail(target.slug, { baseUrl: target.baseUrl });
        const local = await getMangaBySlugLocal(target.slug);

        let mangaId;
        if (!local) {
          const created = await upsertMangaFromApkomik(detail, { saveToS3 });
          mangaId = created.mangaId;
          summary.mangaCreated += 1;
        } else {
          mangaId = local.id;
          summary.mangaUpdated += 1;
          await upsertMangaFromApkomik(detail, { saveToS3 });
        }

        const chaptersStats = {
          created: 0,
          imagesInserted: 0,
          chaptersCount: detail.chapters.length,
        };

        const chaptersToProcess =
          mode === 'delta'
            ? detail.chapters.length
              ? [detail.chapters[0]]
              : []
            : detail.chapters;

        for (const ch of chaptersToProcess) {
          const { chapterId, created } = await upsertChapterFromApkomik(mangaId, target.slug, ch);
          if (created) {
            summary.chaptersCreated += 1;
            chaptersStats.created += 1;
          }
          if (withImages) {
            const { images } = await scrapeChapterImages(target.slug, ch.slug, {
              baseUrl: target.baseUrl,
            });
            const inserted = await upsertChapterImages(chapterId, images, { saveToS3 });
            summary.imagesInserted += inserted;
            chaptersStats.imagesInserted += inserted;
          }
        }

        results.push({
          slug: target.slug,
          mangaId,
          chapters: chaptersStats,
        });
      } catch (e) {
        summary.errors += 1;
        results.push({ slug, error: e.message });
      }
    }

    res.json({ status: true, source: SOURCE, summary, results });
  } catch (e) {
    res.status(500).json({ status: false, error: e.message || 'Internal server error' });
  }
};

const cronSyncFeed = async (req, res) => {
  try {
    const type = String(req.query?.type || 'manga').toLowerCase();
    const page = parsePositiveInt(req.query?.page, 1);
    const mode = req.query?.mode === 'full' ? 'full' : 'delta';
    // Default cron: withImages = true, saveToS3 = true unless explicitly turned off
    const withImages = parseBooleanFlag(req.query?.withImages, true);
    const saveToS3 = parseBooleanFlag(req.query?.saveToS3, false);

    const feed = await scrapeFeed(type, { page });
    
    const summary = {
      feedType: type,
      page,
      requested: feed.length,
      mangaCreated: 0,
      mangaUpdated: 0,
      chaptersCreated: 0,
      imagesInserted: 0,
      errors: 0,
    };
    const results = [];

    for (const item of feed) {
      try {
        const target = resolveMangaTarget(item.slug, BASE_URL);
        if (!target.slug) {
          throw new Error('Invalid manga slug from feed');
        }
        const detail = await scrapeMangaDetail(target.slug, { baseUrl: target.baseUrl });
        const local = await getMangaBySlugLocal(target.slug);

        let mangaId;
        if (!local) {
          const created = await upsertMangaFromApkomik(detail, { saveToS3 });
          mangaId = created.mangaId;
          summary.mangaCreated += 1;
        } else {
          mangaId = local.id;
          summary.mangaUpdated += 1;
          await upsertMangaFromApkomik(detail, { saveToS3 });
        }

        const mangaRow = await getMangaBySlugLocal(target.slug);
        const chaptersRes = await insertChaptersIfMissing(mangaRow, detail.chapters, {
          mode: mode === 'delta' ? 'latestOnly' : 'all',
        });
        summary.chaptersCreated += chaptersRes.inserted;

        if (withImages && chaptersRes.insertedSlugs && chaptersRes.insertedSlugs.length > 0) {
          for (const chSlug of chaptersRes.insertedSlugs) {
            const chId = await findLocalChapterIdBySlug(chSlug);
            if (chId) {
              const origChapterSlug = chSlug.replace(target.slug + '-', '');
              const { images } = await scrapeChapterImages(target.slug, origChapterSlug, {
                baseUrl: target.baseUrl,
              });
              const inserted = await upsertChapterImages(chId, images, { saveToS3 });
              summary.imagesInserted += inserted;
            }
          }
        }

        results.push({
          slug: target.slug,
          mangaId,
          chaptersCreated: chaptersRes.inserted,
          chaptersSkipped: chaptersRes.skipped,
        });
      } catch (e) {
        summary.errors += 1;
        results.push({ slug: item.slug, error: e.message });
      }
    }

    res.json({
      status: true,
      source: SOURCE,
      type,
      page,
      mode,
      withImages,
      summary,
      results,
    });
  } catch (e) {
    res.status(500).json({ status: false, error: e.message || 'Internal server error' });
  }
};

const syncLatest = async (req, res) => {
  try {
    const type = String(req.body?.type || 'manga').toLowerCase();
    const mode = req.body?.mode === 'full' ? 'full' : 'delta';
    const saveToS3 = parseBooleanFlag(req.body?.saveToS3, false);
    const withImages = parseBooleanFlag(req.body?.withImages, false);

    const feed = await scrapeFeed(type, { page: 1 });
    
    const summary = {
      feedCount: feed.length,
      mangaCreated: 0,
      mangaUpdated: 0,
      chaptersCreated: 0,
      imagesInserted: 0,
      errors: 0,
    };
    const results = [];

    for (const item of feed) {
      try {
        const target = resolveMangaTarget(item.slug, BASE_URL);
        if (!target.slug) {
          throw new Error('Invalid manga slug from feed');
        }
        const detail = await scrapeMangaDetail(target.slug, { baseUrl: target.baseUrl });
        const local = await getMangaBySlugLocal(target.slug);

        let mangaId;
        if (!local) {
          const created = await upsertMangaFromApkomik(detail, { saveToS3 });
          mangaId = created.mangaId;
          summary.mangaCreated += 1;
        } else {
          mangaId = local.id;
          summary.mangaUpdated += 1;
          await upsertMangaFromApkomik(detail, { saveToS3 });
        }

        const mangaRow = await getMangaBySlugLocal(target.slug);
        const chaptersRes = await insertChaptersIfMissing(mangaRow, detail.chapters, {
          mode: mode === 'delta' ? 'latestOnly' : 'all',
        });
        summary.chaptersCreated += chaptersRes.inserted;

        if (withImages && chaptersRes.insertedSlugs && chaptersRes.insertedSlugs.length > 0) {
          for (const chSlug of chaptersRes.insertedSlugs) {
            const chId = await findLocalChapterIdBySlug(chSlug);
            if (chId) {
              const origChapterSlug = chSlug.replace(target.slug + '-', '');
              const { images } = await scrapeChapterImages(target.slug, origChapterSlug, {
                baseUrl: target.baseUrl,
              });
              const inserted = await upsertChapterImages(chId, images, { saveToS3 });
              summary.imagesInserted += inserted;
            }
          }
        }

        results.push({
          slug: target.slug,
          mangaId,
          chaptersCreated: chaptersRes.inserted,
          chaptersSkipped: chaptersRes.skipped,
        });
      } catch (e) {
        summary.errors += 1;
        results.push({ slug: item.slug, error: e.message });
      }
    }

    res.json({ status: true, mode, source: SOURCE, summary, results });
  } catch (e) {
    res.status(500).json({ status: false, error: e.message || 'Internal server error' });
  }
};

const syncMangaBySlug = async (req, res) => {
  const rawSlug = req.params.slug;
  try {
    const target = resolveMangaTarget(rawSlug, BASE_URL);
    const slug = target.slug;
    if (!slug) {
      return res.status(400).json({ status: false, error: 'Slug manga tidak valid' });
    }

    const mode = req.body?.mode === 'full' ? 'full' : 'delta';
    const saveToS3 = parseBooleanFlag(req.body?.saveToS3, false);
    const detail = await scrapeMangaDetail(slug, { baseUrl: target.baseUrl });
    const local = await getMangaBySlugLocal(slug);

    if (!local) {
      const { mangaId } = await upsertMangaFromApkomik(detail, { saveToS3 });
      const mangaRow = await getMangaBySlugLocal(slug);
      const chaptersRes = await insertChaptersIfMissing(mangaRow, detail.chapters, { mode: 'all' });
      return res.json({
        status: true,
        action: 'created',
        mangaId,
        chaptersInserted: chaptersRes.inserted,
        chaptersSkipped: chaptersRes.skipped,
      });
    }

    await upsertMangaFromApkomik(detail, { saveToS3 });

    const chaptersRes = await insertChaptersIfMissing(
      local,
      detail.chapters,
      { mode: mode === 'delta' ? 'latestOnly' : 'all' }
    );

    res.json({
      status: true,
      action: 'updated',
      mangaId: local.id,
      chaptersInserted: chaptersRes.inserted,
      chaptersSkipped: chaptersRes.skipped,
    });
  } catch (e) {
    res.status(500).json({ status: false, error: e.message || 'Internal server error' });
  }
};

const syncMangaInit = async (req, res) => {
  const rawSlug = req.params.slug;
  try {
    const target = resolveMangaTarget(rawSlug, BASE_URL);
    const slug = target.slug;
    if (!slug) {
      return res.status(400).json({ status: false, error: 'Slug manga tidak valid' });
    }

    const mode = req.body?.mode === 'full' ? 'full' : 'delta';
    const withImages = parseBooleanFlag(req.body?.withImages, false);
    const saveToS3 = parseBooleanFlag(req.body?.saveToS3, false);

    const detail = await scrapeMangaDetail(slug, { baseUrl: target.baseUrl });
    const mangaUpsert = await upsertMangaFromApkomik(detail, { saveToS3 });
    const mangaRow = await getMangaBySlugLocal(slug);
    if (!mangaRow) {
      return res.status(500).json({ status: false, error: 'Manga tidak ditemukan setelah upsert' });
    }
    const existingChapterSlugs = await getExistingChapterSlugSet(mangaRow.id);

    const allChaptersToPlan =
      mode === 'delta' ? (detail.chapters.length ? [detail.chapters[0]] : []) : detail.chapters;
    const defaultBatchSize = mode === 'full' ? 100 : Math.max(allChaptersToPlan.length, 1);
    const offset = parseNonNegativeInt(req.body?.offset, 0);
    const limit = parsePositiveInt(req.body?.limit, defaultBatchSize);
    const chaptersToPlan = allChaptersToPlan.slice(offset, offset + limit);
    const nextOffset = offset + chaptersToPlan.length;
    const hasMore = nextOffset < allChaptersToPlan.length;

    const chapters = [];
    let chaptersCreated = 0;
    let imagesInsertedTotal = 0;
    let chapterErrors = 0;

    for (const ch of chaptersToPlan) {
      const localSlug = buildLocalChapterSlug(slug, ch.slug);
      const existedForManga = existingChapterSlugs.has(localSlug);

      try {
        const { chapterId, created } = await upsertChapterFromApkomik(mangaRow.id, slug, ch);
        if (created) chaptersCreated += 1;

        let imagesCount = 0;
        let imagesInserted = 0;
        let chapterError = null;

        if (withImages) {
          try {
            const { images } = await scrapeChapterImages(slug, ch.slug, {
              baseUrl: target.baseUrl,
            });
            imagesCount = images.length;
            imagesInserted = await upsertChapterImages(chapterId, images, { saveToS3 });
            imagesInsertedTotal += imagesInserted;
          } catch (imageErr) {
            chapterErrors += 1;
            chapterError = imageErr.message || 'Failed to sync chapter images';
          }
        }

        chapters.push({
          ikiruSlug: ch.slug,
          localSlug,
          title: ch.title,
          chapterNumber: ch.chapterNumber,
          existedOnMangaBeforeInit: existedForManga,
          chapterId,
          chapterCreated: created,
          imagesCount,
          imagesInserted,
          error: chapterError,
        });
      } catch (chapterErr) {
        chapterErrors += 1;
        chapters.push({
          ikiruSlug: ch.slug,
          localSlug,
          title: ch.title,
          chapterNumber: ch.chapterNumber,
          existedOnMangaBeforeInit: existedForManga,
          chapterId: null,
          chapterCreated: false,
          imagesCount: 0,
          imagesInserted: 0,
          error: chapterErr.message || 'Failed to sync chapter',
        });
      }
    }

    const existingAfter = await getExistingChapterSlugSet(mangaRow.id);

    res.json({
      status: true,
      source: SOURCE,
      mangaId: mangaUpsert.mangaId,
      mangaCreated: mangaUpsert.created,
      mode,
      withImages,
      saveToS3,
      chaptersFullySynced: withImages,
      summary: {
        chaptersTotal: allChaptersToPlan.length,
        chaptersPlanned: chaptersToPlan.length,
        chaptersCreated,
        imagesInserted: imagesInsertedTotal,
        chapterErrors,
      },
      pagination: {
        offset,
        limit,
        nextOffset,
        hasMore,
        totalChapters: allChaptersToPlan.length,
      },
      chapters: chapters.map((row) => ({
        ...row,
        exists: existingAfter.has(row.localSlug),
      })),
    });
  } catch (e) {
    res.status(500).json({ status: false, error: e.message || 'Internal server error' });
  }
};

const syncMangaChapter = async (req, res) => {
  const { chapterSlug } = req.params;
  const rawSlug = req.params.slug;
  try {
    const target = resolveMangaTarget(rawSlug, BASE_URL);
    const slug = target.slug;
    if (!slug) {
      return res.status(400).json({ status: false, error: 'Slug manga tidak valid' });
    }

    const withImages = parseBooleanFlag(req.body?.withImages, false);
    const saveToS3 = parseBooleanFlag(req.body?.saveToS3, false);

    let localManga = await getMangaBySlugLocal(slug);
    let detail = null;
    if (!localManga) {
      detail = await scrapeMangaDetail(slug, { baseUrl: target.baseUrl });
      await upsertMangaFromApkomik(detail, { saveToS3 });
      localManga = await getMangaBySlugLocal(slug);
    }

    let chapterData = {
      slug: chapterSlug,
      title: req.body?.title ? String(req.body.title) : null,
      chapterNumber:
        req.body?.chapterNumber !== undefined && req.body?.chapterNumber !== null
          ? req.body.chapterNumber
          : null,
    };

    if (!chapterData.title) {
      if (!detail) detail = await scrapeMangaDetail(slug, { baseUrl: target.baseUrl });
      const found = Array.isArray(detail.chapters)
        ? detail.chapters.find((c) => String(c.slug) === String(chapterSlug))
        : null;
      if (!found) {
        return res.status(404).json({ status: false, error: 'Chapter not found on Apkomik' });
      }
      chapterData.title = found.title;
      chapterData.chapterNumber = found.chapterNumber;
    }

    const { chapterId, created } = await upsertChapterFromApkomik(localManga.id, slug, chapterData);

    let imagesCount = 0;
    let imagesInserted = 0;
    if (withImages) {
      const { images } = await scrapeChapterImages(slug, chapterSlug, {
        baseUrl: target.baseUrl,
      });
      imagesCount = images.length;
      imagesInserted = await upsertChapterImages(chapterId, images, { saveToS3 });
    }

    res.json({
      status: true,
      source: SOURCE,
      mangaId: localManga.id,
      chapterId,
      chapterCreated: created,
      imagesCount,
      imagesInserted,
    });
  } catch (e) {
    res.status(500).json({ status: false, error: e.message || 'Internal server error' });
  }
};

const syncChapterImages = async (req, res) => {
  const { chapterSlug } = req.params;
  const rawSlug = req.params.slug;
  try {
    const target = resolveMangaTarget(rawSlug, BASE_URL);
    const slug = target.slug;
    if (!slug) {
      return res.status(400).json({ status: false, error: 'Slug manga tidak valid' });
    }

    const saveToS3 = parseBooleanFlag(req.body?.saveToS3, false);
    const localChapterSlug = buildLocalChapterSlug(slug, chapterSlug);
    const chapterId = await findLocalChapterIdBySlug(localChapterSlug);
    if (!chapterId) {
      return res.status(404).json({ status: false, error: 'Chapter not found in DB' });
    }

    const { images } = await scrapeChapterImages(slug, chapterSlug, {
      baseUrl: target.baseUrl,
    });
    const inserted = await upsertChapterImages(chapterId, images, { saveToS3 });

    res.json({
      status: true,
      chapterId,
      imagesCount: images.length,
      imagesInserted: inserted,
    });
  } catch (e) {
    res.status(500).json({ status: false, error: e.message || 'Internal server error' });
  }
};

module.exports = {
  listFeed,
  syncSelected,
  syncLatest,
  syncMangaBySlug,
  syncMangaInit,
  syncMangaChapter,
  syncChapterImages,
  cronSyncFeed,
};
