/* eslint-disable no-undef */
/* eslint-env node */
const db = require('../db');
const { ikiruFetchHtml, getIkiruAxios } = require('../utils/ikiruSession');
const { uploadUrlToS3 } = require('../utils/s3Upload');
const path = require('path');

const BASE_URL = 'https://02.ikiru.wtf';
const SOURCE = 'ikiru';

let _categoriesCache = null;
let _categoriesCacheAt = 0;
const CATEGORIES_CACHE_TTL_MS = 5 * 60 * 1000;

function cleanText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchHtml(url) {
  return ikiruFetchHtml(url, { timeout: 20000 });
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
  if (!slugs.length) return { matched: 0, inserted: 0 };

  const slugToId = await getCategorySlugToIdMap();
  const categoryIds = slugs.map((s) => slugToId.get(s)).filter(Boolean);
  if (!categoryIds.length) return { matched: 0, inserted: 0 };

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

function normalizePage(pageRaw) {
  const page = parseInt(pageRaw, 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

/**
 * Ikiru detail page: aggregateRating (schema.org) or star block next to "Ratings" label.
 */
function parseIkiruMangaRating($) {
  const scope = $('[itemprop="aggregateRating"], [itemtype*="AggregateRating"]').first();
  if (scope && scope.length) {
    const metaRv = scope.find('meta[itemprop="ratingValue"]').first();
    if (metaRv && metaRv.length) {
      const c = metaRv.attr('content');
      if (c != null && String(c).trim() !== '') {
        const n = parseFloat(String(c).replace(',', '.'));
        if (Number.isFinite(n) && n > 0) return n;
      }
    }
    const rv = scope.find('[itemprop="ratingValue"]').first();
    if (rv && rv.length) {
      const fromAttr = rv.attr('content');
      if (fromAttr != null && String(fromAttr).trim() !== '') {
        const n = parseFloat(String(fromAttr).replace(',', '.'));
        if (Number.isFinite(n) && n > 0) return n;
      }
      const fromText = cleanText(rv.text());
      if (fromText) {
        const n = parseFloat(fromText.replace(',', '.'));
        if (Number.isFinite(n) && n > 0) return n;
      }
    }
  }

  let el = $('div[itemprop="ratingValue"], span[itemprop="ratingValue"]').first();
  if (el && el.length) {
    const fromAttr = el.attr('content');
    if (fromAttr != null && String(fromAttr).trim() !== '') {
      const n = parseFloat(String(fromAttr).replace(',', '.'));
      if (Number.isFinite(n) && n > 0) return n;
    }
    const n = parseFloat(cleanText(el.text()).replace(',', '.'));
    if (Number.isFinite(n) && n > 0) return n;
  }

  const ratingsLabel = $('small')
    .filter((_, node) => /ratings/i.test(cleanText($(node).text())))
    .first();
  if (ratingsLabel && ratingsLabel.length) {
    const li = ratingsLabel.closest('li');
    const bold = li.find('span.font-bold').first();
    if (bold && bold.length) {
      const n = parseFloat(cleanText(bold.text()).replace(',', '.'));
      if (Number.isFinite(n) && n > 0) return n;
    }
  }

  return null;
}

function buildPagedUrl(basePath, page) {
  const normalizedPage = normalizePage(page);
  if (normalizedPage <= 1) return `${BASE_URL}${basePath}`;
  return `${BASE_URL}${basePath}?the_page=${normalizedPage}`;
}

async function scrapeLatestFeed({ page } = {}) {
  const url = buildPagedUrl('/latest-update/', page);
  const $ = await fetchHtml(url);
  const mangaMap = new Map();

  $('a[href*="/manga/"]').each((_, el) => {
    const link = $(el);
    const href = link.attr('href') || '';
    if (!href.includes('/manga/')) return;
    if (href.includes('/chapter-')) return;

    const fullHref = href.startsWith('http') ? href : BASE_URL + href;
    const slug = href
      .replace(BASE_URL, '')
      .replace(/^\/manga\//, '')
      .replace(/\/$/, '');
    if (!slug) return;

    let title = cleanText(link.text());
    const img =
      link.find('img').first() ||
      link.closest('article, .card, .item, .series, div, li, section').find('img').first();
    if (!title && img && img.length) title = cleanText(img.attr('alt') || '');
    if (!title) title = slug.replace(/-/g, ' ');

    let coverImage = null;
    if (img && img.length) {
      let src = img.attr('data-src') || img.attr('src');
      if (src) {
        if (src.startsWith('//')) src = 'https:' + src;
        else if (src.startsWith('/')) src = BASE_URL + src;
        coverImage = src;
      }
    }

    if (!mangaMap.has(slug)) {
      mangaMap.set(slug, { slug, title, url: fullHref, coverImage });
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

async function scrapeProjectFeed({ page } = {}) {
  const url = buildPagedUrl('/project/', page);
  const $ = await fetchHtml(url);
  const mangaMap = new Map();

  $('a[href*="/manga/"]').each((_, el) => {
    const link = $(el);
    const href = link.attr('href') || '';
    if (!href.includes('/manga/')) return;
    if (href.includes('/chapter-')) return;

    const fullHref = href.startsWith('http') ? href : BASE_URL + href;
    const slug = href
      .replace(BASE_URL, '')
      .replace(/^\/manga\//, '')
      .replace(/\/$/, '');
    if (!slug) return;

    let title = cleanText(link.text());
    const img =
      link.find('img').first() ||
      link.closest('article, .card, .item, .series, div, li, section').find('img').first();
    if (!title && img && img.length) title = cleanText(img.attr('alt') || '');
    if (!title) title = slug.replace(/-/g, ' ');

    let coverImage = null;
    if (img && img.length) {
      let src = img.attr('data-src') || img.attr('src');
      if (src) {
        if (src.startsWith('//')) src = 'https:' + src;
        else if (src.startsWith('/')) src = BASE_URL + src;
        coverImage = src;
      }
    }

    if (!mangaMap.has(slug)) {
      mangaMap.set(slug, { slug, title, url: fullHref, coverImage });
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

async function scrapeMangaDetail(slug) {
  const mangaUrl = `${BASE_URL}/manga/${slug}/`;
  const $ = await fetchHtml(mangaUrl);

  // Prefer schema title if available.
  const titleEl = $('[itemprop="name"]').first();
  const title =
    cleanText(titleEl.text()) ||
    cleanText($('h1').first().text()) ||
    cleanText($('h2').first().text()) ||
    slug.replace(/-/g, ' ');

  // Ikiru often renders alternative name as a line underneath the main title.
  // Example: <h1 itemprop="name">...</h1><div class="... line-clamp-1">Alternative...</div>
  let alternativeName = '';
  if (titleEl && titleEl.length) {
    const parent = titleEl.parent();

    // Most common: alternative is directly after the title node.
    alternativeName = cleanText(titleEl.next('div').first().text());

    // Fallback: look for a "line-clamp-1" div within the same block.
    if (!alternativeName) alternativeName = cleanText(parent.find('div.line-clamp-1').first().text());

    // Final fallback: any non-empty div directly under the title parent, excluding the title itself.
    if (!alternativeName) {
      alternativeName = cleanText(
        parent
          .find('div')
          .filter((_, el) => {
            const $el = $(el);
            const t = cleanText($el.text());
            if (!t) return false;
            if ($el.attr('itemprop')) return false;
            return true;
          })
          .first()
          .text()
      );
    }
  }

  let coverImage = null;
  const coverImgEl = $('div[itemprop="image"] img').first() || $('main img').first();
  if (coverImgEl && coverImgEl.length) {
    let src = coverImgEl.attr('data-src') || coverImgEl.attr('src');
    if (src) {
      if (src.startsWith('//')) src = 'https:' + src;
      else if (src.startsWith('/')) src = BASE_URL + src;
      coverImage = src;
    }
  }

  // Prefer schema description if available.
  let synopsis = '';
  const descEl = $('div[itemprop="description"]').first();
  if (descEl && descEl.length) {
    synopsis = cleanText(descEl.find('p').first().text() || descEl.text());
    // Remove "baca cuma di ..." footer if present.
    synopsis = synopsis.replace(/\s*baca\s+cuma\s+di\s*ikiru\.id\.?\s*$/i, '').trim();
  } else {
    // Fallback: old "Synopsis" header-based extraction.
    const synopsisHeader = $('h3, h4')
      .filter((_, el) => cleanText($(el).text()).toLowerCase() === 'synopsis')
      .first();
    if (synopsisHeader.length) {
      synopsis = cleanText(synopsisHeader.parent().text().replace(/Synopsis/i, ''));
    }
  }

  const genres = new Set();
  $('a[href*="/genre/"], a[href*="/genres/"]').each((_, el) => {
    const a = $(el);
    const href = a.attr('href') || '';
    const txt = cleanText(a.text());
    const slugFromHref = href
      .split('?')[0]
      .split('/')
      .filter(Boolean)
      .pop();
    const gSlug = slugFromHref ? slugifyGenre(slugFromHref) : slugifyGenre(txt);
    if (gSlug) genres.add(gSlug);
  });

  if (genres.size === 0) {
    const genreText = cleanText($('body').text()).toLowerCase().slice(0, 50000);
    const known = [
      'action',
      'adventure',
      'comedy',
      'drama',
      'fantasy',
      'romance',
      'isekai',
      'shounen',
      'seinen',
      'slice of life',
      'supernatural',
      'school life',
      'horror',
      'mystery',
      'sports',
      'thriller',
      'ecchi',
    ];
    for (const k of known) {
      if (genreText.includes(k)) genres.add(slugifyGenre(k));
    }
  }

  const chapters = [];
  const chapterListEl = $('#chapter-list');
  if (chapterListEl && chapterListEl.length) {
    const rawHxGet =
      chapterListEl.attr('hx-get') ||
      chapterListEl.attr('data-hx-get') ||
      chapterListEl.attr('data-hxGet') ||
      chapterListEl.attr('hxGet');

    let chapterDoc = null;
    if (rawHxGet) {
      const hxGet = rawHxGet.trim();
      let chapterListUrl;
      if (hxGet.startsWith('http')) chapterListUrl = hxGet;
      else if (hxGet.startsWith('//')) chapterListUrl = 'https:' + hxGet;
      else if (hxGet.startsWith('/')) chapterListUrl = BASE_URL + hxGet;
      else chapterListUrl = `${BASE_URL}/${hxGet}`;
      try {
        chapterDoc = await fetchHtml(chapterListUrl);
      } catch {
        chapterDoc = $;
      }
    } else {
      chapterDoc = $;
    }

    const $$ = chapterDoc;
    $$('#chapter-list [data-chapter-number], [data-chapter-number]').each((_, el) => {
      const row = $$(el);
      const dataNumber = row.attr('data-chapter-number');
      const linkEl = row.find('a[href*="/chapter-"]').first();
      const href = linkEl.attr('href') || '';
      if (!href || !href.includes('/chapter-')) return;

      const text = cleanText(linkEl.text());
      const fullUrl = href.startsWith('http') ? href : BASE_URL + href;
      const chapterSlug = href.split('/').filter(Boolean).pop();

      let chapterNumber = null;
      if (dataNumber && !Number.isNaN(Number(dataNumber))) chapterNumber = Number(dataNumber);
      else {
        const numMatch =
          chapterSlug.match(/chapter-([\d.]+)/i) || text.match(/chapter\s+([\d.]+)/i);
        if (numMatch) chapterNumber = parseFloat(numMatch[1]);
      }

      chapters.push({
        title: text || chapterSlug,
        url: fullUrl,
        slug: chapterSlug,
        chapterNumber,
      });
    });
  }

  const rating = parseIkiruMangaRating($);

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
  };
}

function normalizeChapterTitle(rawTitle, chapterNumber) {
  const t = cleanText(rawTitle);
  if (!t) return chapterNumber ? `Chapter ${chapterNumber}` : 'Chapter';
  const match = t.match(/chapter\s+([\d.]+)/i);
  if (match) return `Chapter ${match[1]}`;
  return t.split(/\s+\d+\s+\d+$/).shift() || t;
}

function buildLocalChapterSlug(mangaSlug, ikiruChapterSlug) {
  return `${mangaSlug}-${ikiruChapterSlug}`;
}

async function getMangaBySlugLocal(slug) {
  const [rows] = await db.execute('SELECT * FROM manga WHERE slug = ? LIMIT 1', [slug]);
  return rows[0] || null;
}

async function upsertMangaFromIkiru(detail, { saveToS3 = false } = {}) {
  const existing = await getMangaBySlugLocal(detail.slug);
  if (existing) {
    if (!existing.is_input_manual) {
      await db.execute('UPDATE manga SET is_input_manual = TRUE WHERE id = ?', [existing.id]);
    }
    if (Array.isArray(detail.genres) && detail.genres.length) {
      await upsertMangaGenres(existing.id, detail.genres);
    }

    // If fields are empty, try to backfill them.
    const shouldUpdateAlternative =
      (!existing.alternative_name || String(existing.alternative_name).trim() === '') &&
      detail.alternativeName;
    const shouldUpdateSynopsis =
      (!existing.synopsis || String(existing.synopsis).trim() === '') && detail.synopsis;

    if (shouldUpdateAlternative || shouldUpdateSynopsis) {
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
      values.push(existing.id);

      await db.execute(`UPDATE manga SET ${setClauses.join(', ')} WHERE id = ?`, values);
    }

    if (detail.rating != null && Number.isFinite(Number(detail.rating)) && Number(detail.rating) > 0) {
      await db.execute('UPDATE manga SET rating = ? WHERE id = ?', [Number(detail.rating), existing.id]);
    }

    // Backfill cover only when it's still empty; by default we store Ikiru URL (no download/upload).
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
        const key = `komiknesia/ikiru/manga/${detail.slug}/cover${ext}`;
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
      const key = `komiknesia/ikiru/manga/${detail.slug}/cover${ext}`;
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
      'manga',
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

async function getExistingChapterSlugSet(mangaId) {
  const [rows] = await db.execute('SELECT slug FROM chapters WHERE manga_id = ?', [mangaId]);
  return new Set(rows.map((r) => r.slug));
}

async function insertChaptersIfMissing(manga, ikiruChapters, { mode }) {
  const existingSet = await getExistingChapterSlugSet(manga.id);
  let inserted = 0;
  let skipped = 0;
  const insertedSlugs = [];

  const chaptersToProcess =
    mode === 'latestOnly' ? (ikiruChapters.length ? [ikiruChapters[0]] : []) : ikiruChapters;

  for (const ch of chaptersToProcess) {
    const localSlug = buildLocalChapterSlug(manga.slug, ch.slug);
    if (existingSet.has(localSlug)) {
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
  }

  return { inserted, skipped, insertedSlugs };
}

async function scrapeChapterImages(mangaSlug, ikiruChapterSlug) {
  const chapterUrl = `${BASE_URL}/manga/${mangaSlug}/${ikiruChapterSlug}/`;
  const $ = await fetchHtml(chapterUrl);
  const images = [];

  const readerSection = $('section[data-image-data="1"]').first();
  const scope = readerSection && readerSection.length ? readerSection : $('body');

  scope.find('img').each((_, el) => {
    let src = $(el).attr('data-src') || $(el).attr('src');
    if (!src) return;
    if (src.startsWith('//')) src = 'https:' + src;
    else if (src.startsWith('/')) src = BASE_URL + src;

    const lower = src.toLowerCase();
    const isPanelImage = lower.includes('cdn.uqni.net/images') || lower.match(/\.(webp|jpg|jpeg|png)$/i);
    if (!isPanelImage) return;
    images.push(src);
  });

  return { url: chapterUrl, images };
}

async function upsertChapterImages(chapterId, imageUrls, { saveToS3 = false } = {}) {
  const [existingRows] = await db.execute(
    'SELECT image_path, page_number FROM chapter_images WHERE chapter_id = ?',
    [chapterId]
  );
  const existingByPage = new Map(existingRows.map((r) => [r.page_number, r.image_path]));
  let inserted = 0;

  // Map scraped order to page_number 1..N (idempotent per page). The previous loop used a single
  // `page` cursor and `continue` on collision, which dropped URLs entirely when early pages existed.
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
      const key = `komiknesia/ikiru/chapters/${chapterId}/pages/${page}${ext}`;
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
      if (String(prevPath) === String(storedUrl)) {
        continue;
      }
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

async function syncFeed(feedItems, { mode, saveToS3 = false }) {
  const summary = {
    feedCount: feedItems.length,
    mangaCreated: 0,
    mangaSkipped: 0,
    chaptersInserted: 0,
    chaptersSkipped: 0,
    errors: 0,
  };
  const results = [];

  for (const item of feedItems) {
    try {
      const localManga = await getMangaBySlugLocal(item.slug);

      if (!localManga) {
        const detail = await scrapeMangaDetail(item.slug);
        const { mangaId } = await upsertMangaFromIkiru(detail, { saveToS3 });
        summary.mangaCreated += 1;

        const mangaRow = await getMangaBySlugLocal(detail.slug);
        const chaptersRes = await insertChaptersIfMissing(mangaRow, detail.chapters, {
          mode: 'all',
        });
        summary.chaptersInserted += chaptersRes.inserted;
        summary.chaptersSkipped += chaptersRes.skipped;
        results.push({
          slug: item.slug,
          action: 'created',
          mangaId,
          chaptersInserted: chaptersRes.inserted,
          chaptersSkipped: chaptersRes.skipped,
        });
      } else {
        summary.mangaSkipped += 1;
        const detail = await scrapeMangaDetail(item.slug);
        // Backfill alternative_name/synopsis (and genres) when they are still empty.
        await upsertMangaFromIkiru(detail, { saveToS3 });
        const chaptersRes = await insertChaptersIfMissing(localManga, detail.chapters, {
          mode: mode === 'delta' ? 'latestOnly' : 'all',
        });
        summary.chaptersInserted += chaptersRes.inserted;
        summary.chaptersSkipped += chaptersRes.skipped;
        results.push({
          slug: item.slug,
          action: 'skipped_manga',
          mangaId: localManga.id,
          chaptersInserted: chaptersRes.inserted,
          chaptersSkipped: chaptersRes.skipped,
        });
      }
    } catch (e) {
      summary.errors += 1;
      results.push({ slug: item.slug, error: e.message });
    }
  }

  return { summary, results };
}

const listFeed = async (req, res) => {
  try {
    const type = String(req.query?.type || 'latest').toLowerCase();
    const page = normalizePage(req.query?.page);

    const feed =
      type === 'project' ? await scrapeProjectFeed({ page }) : await scrapeLatestFeed({ page });

    res.json({
      status: true,
      source: SOURCE,
      type: type === 'project' ? 'project' : 'latest',
      page,
      count: feed.length,
      data: feed,
    });
  } catch (e) {
    res.status(500).json({ status: false, error: e.message || 'Internal server error' });
  }
};

async function upsertChapterFromIkiru(mangaId, mangaSlug, ch) {
  const localSlug = buildLocalChapterSlug(mangaSlug, ch.slug);
  const [existing] = await db.execute('SELECT id FROM chapters WHERE slug = ? LIMIT 1', [localSlug]);
  if (existing.length) return { chapterId: existing[0].id, created: false, slug: localSlug };

  const chapterTitle = normalizeChapterTitle(ch.title, ch.chapterNumber);
  const chapterNumber =
    ch.chapterNumber !== null && ch.chapterNumber !== undefined ? String(ch.chapterNumber) : null;

  const [result] = await db.execute(
    'INSERT INTO chapters (manga_id, title, chapter_number, slug, cover) VALUES (?, ?, ?, ?, ?)',
    [mangaId, chapterTitle, chapterNumber, localSlug, null]
  );

  return { chapterId: result.insertId, created: true, slug: localSlug };
}

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
    const withImages = req.body?.withImages === true || req.body?.withImages === 'true';
    // New param: default false => store Ikiru URL directly (no download/upload to S3).
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
        const detail = await scrapeMangaDetail(slug);
        const local = await getMangaBySlugLocal(slug);

        let mangaId;
        if (!local) {
          const created = await upsertMangaFromIkiru(detail, { saveToS3 });
          mangaId = created.mangaId;
          summary.mangaCreated += 1;
        } else {
          mangaId = local.id;
          summary.mangaUpdated += 1;
          // Backfill alternative_name/synopsis (and genres) when they are still empty.
          await upsertMangaFromIkiru(detail, { saveToS3 });
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

        const createdChapters = [];
        for (const ch of chaptersToProcess) {
          const { chapterId, created } = await upsertChapterFromIkiru(mangaId, slug, ch);
          if (created) {
            createdChapters.push({ chapterId, ikiruSlug: ch.slug });
            summary.chaptersCreated += 1;
            chaptersStats.created += 1;
          }
        }

        if (withImages) {
          for (const ch of createdChapters) {
            const { images } = await scrapeChapterImages(slug, ch.ikiruSlug);
            const inserted = await upsertChapterImages(ch.chapterId, images, { saveToS3 });
            summary.imagesInserted += inserted;
            chaptersStats.imagesInserted += inserted;
          }
        }

        results.push({
          slug,
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

const syncLatest = async (req, res) => {
  try {
    const mode = req.body?.mode === 'full' ? 'full' : 'delta';
    const saveToS3 = parseBooleanFlag(req.body?.saveToS3, false);
    const feed = await scrapeLatestFeed({ page: 1 });
    const { summary, results } = await syncFeed(feed, { mode, saveToS3 });
    res.json({ status: true, mode, source: SOURCE, summary, results });
  } catch (e) {
    res.status(500).json({ status: false, error: e.message || 'Internal server error' });
  }
};

const syncProject = async (req, res) => {
  try {
    const mode = req.body?.mode === 'full' ? 'full' : 'delta';
    const saveToS3 = parseBooleanFlag(req.body?.saveToS3, false);
    const feed = await scrapeProjectFeed({ page: 1 });
    const { summary, results } = await syncFeed(feed, { mode, saveToS3 });
    res.json({ status: true, mode, source: SOURCE, summary, results });
  } catch (e) {
    res.status(500).json({ status: false, error: e.message || 'Internal server error' });
  }
};

// Endpoint untuk cronjob:
// POST /api/ikiru/cron-sync?type=latest|project&page=1&mode=delta|full&withImages=true
// - Sama seperti sync admin: semua GET ke Ikiru lewat utils/ikiruSession (login + cookie).
// - Auto insert manga + semua chapter (sesuai mode) yang belum ada di DB kita
// - Untuk chapter baru, sekaligus insert images-nya
// - Manga yang sudah ada tidak dihapus/diganti; hanya dilengkapi chapter/images baru
const cronSyncFeed = async (req, res) => {
  try {
    const type = String(req.query?.type || 'latest').toLowerCase();
    const page = normalizePage(req.query?.page);
    const mode = req.query?.mode === 'full' ? 'full' : 'delta';
    // Default cron: withImages = true kecuali eksplisit dimatikan
    const withImages = parseBooleanFlag(req.query?.withImages, true);
    // Default cron: saveToS3 = true kecuali eksplisit dimatikan.
    const saveToS3 = parseBooleanFlag(req.query?.saveToS3, true);

    await getIkiruAxios();

    const feed =
      type === 'project' ? await scrapeProjectFeed({ page }) : await scrapeLatestFeed({ page });

    const summary = {
      feedType: type === 'project' ? 'project' : 'latest',
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
      const slug = item.slug;
      try {
        const detail = await scrapeMangaDetail(slug);
        const local = await getMangaBySlugLocal(slug);

        let mangaId;
        if (!local) {
          const created = await upsertMangaFromIkiru(detail, { saveToS3 });
          mangaId = created.mangaId;
          summary.mangaCreated += 1;
        } else {
          mangaId = local.id;
          summary.mangaUpdated += 1;
          // Backfill alternative_name/synopsis (and genres) when they are still empty.
          await upsertMangaFromIkiru(detail, { saveToS3 });
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

        const createdChapters = [];
        for (const ch of chaptersToProcess) {
          const { chapterId, created } = await upsertChapterFromIkiru(mangaId, slug, ch);
          if (created) {
            createdChapters.push({ chapterId, ikiruSlug: ch.slug });
            summary.chaptersCreated += 1;
            chaptersStats.created += 1;
          }
        }

        if (withImages) {
          for (const ch of createdChapters) {
            const { images } = await scrapeChapterImages(slug, ch.ikiruSlug);
            const inserted = await upsertChapterImages(ch.chapterId, images, { saveToS3 });
            summary.imagesInserted += inserted;
            chaptersStats.imagesInserted += inserted;
          }
        }

        results.push({
          slug,
          mangaId,
          chapters: chaptersStats,
        });
      } catch (e) {
        summary.errors += 1;
        results.push({ slug: item.slug, error: e.message });
      }
    }

    res.json({
      status: true,
      source: SOURCE,
      type: type === 'project' ? 'project' : 'latest',
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

const syncMangaBySlug = async (req, res) => {
  const { slug } = req.params;
  try {
    const mode = req.body?.mode === 'full' ? 'full' : 'delta';
    const saveToS3 = parseBooleanFlag(req.body?.saveToS3, false);
    const detail = await scrapeMangaDetail(slug);
    const local = await getMangaBySlugLocal(slug);

    if (!local) {
      const { mangaId } = await upsertMangaFromIkiru(detail, { saveToS3 });
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

    // Backfill alternative_name/synopsis (and genres) when they are still empty.
    await upsertMangaFromIkiru(detail, { saveToS3 });

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

// 1) Init + plan chapters queue:
// POST /api/admin/ikiru-sync/manga/:slug/init { mode, withImages?, saveToS3? }
// Returns chapter list + whether chapter already exists in DB.
const syncMangaInit = async (req, res) => {
  const { slug } = req.params;
  try {
    const mode = req.body?.mode === 'full' ? 'full' : 'delta';
    const withImages = req.body?.withImages === true || req.body?.withImages === 'true';
    const saveToS3 = parseBooleanFlag(req.body?.saveToS3, false);

    const detail = await scrapeMangaDetail(slug);
    const mangaUpsert = await upsertMangaFromIkiru(detail, { saveToS3 });
    const mangaRow = await getMangaBySlugLocal(slug);
    const existingChapterSlugs = await getExistingChapterSlugSet(mangaRow.id);

    const chaptersToPlan =
      mode === 'delta' ? (detail.chapters.length ? [detail.chapters[0]] : []) : detail.chapters;

    const chapters = chaptersToPlan.map((ch) => {
      const localSlug = buildLocalChapterSlug(slug, ch.slug);
      return {
        ikiruSlug: ch.slug,
        localSlug,
        title: ch.title,
        chapterNumber: ch.chapterNumber,
        exists: existingChapterSlugs.has(localSlug),
      };
    });

    res.json({
      status: true,
      source: SOURCE,
      mangaId: mangaUpsert.mangaId,
      mangaCreated: mangaUpsert.created,
      mode,
      withImages,
      saveToS3,
      chapters,
    });
  } catch (e) {
    res.status(500).json({ status: false, error: e.message || 'Internal server error' });
  }
};

// 2) Sync a single chapter (optionally images):
// POST /api/admin/ikiru-sync/manga/:slug/chapter/:chapterSlug
// Body: { title?, chapterNumber?, withImages?, saveToS3? }
const syncMangaChapter = async (req, res) => {
  const { slug, chapterSlug } = req.params;
  try {
    const withImages = req.body?.withImages === true || req.body?.withImages === 'true';
    const saveToS3 = parseBooleanFlag(req.body?.saveToS3, false);

    let localManga = await getMangaBySlugLocal(slug);
    let detail = null;
    if (!localManga) {
      detail = await scrapeMangaDetail(slug);
      await upsertMangaFromIkiru(detail, { saveToS3 });
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

    // If title isn't provided, fall back to scraping manga detail once to locate chapter metadata.
    if (!chapterData.title) {
      if (!detail) detail = await scrapeMangaDetail(slug);
      const found = Array.isArray(detail.chapters)
        ? detail.chapters.find((c) => String(c.slug) === String(chapterSlug))
        : null;
      if (!found) {
        return res.status(404).json({ status: false, error: 'Chapter not found on Ikiru' });
      }
      chapterData.title = found.title;
      chapterData.chapterNumber = found.chapterNumber;
    }

    const { chapterId, created } = await upsertChapterFromIkiru(localManga.id, slug, chapterData);

    let imagesCount = 0;
    let imagesInserted = 0;
    if (withImages) {
      const { images } = await scrapeChapterImages(slug, chapterSlug);
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
  const { slug, chapterSlug } = req.params;
  try {
    const saveToS3 = parseBooleanFlag(req.body?.saveToS3, false);
    const localChapterSlug = buildLocalChapterSlug(slug, chapterSlug);
    const chapterId = await findLocalChapterIdBySlug(localChapterSlug);
    if (!chapterId) {
      return res.status(404).json({ status: false, error: 'Chapter not found in DB' });
    }

    const { images } = await scrapeChapterImages(slug, chapterSlug);
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
  syncProject,
  cronSyncFeed,
  syncMangaBySlug,
  syncMangaInit,
  syncMangaChapter,
  syncChapterImages,
};

