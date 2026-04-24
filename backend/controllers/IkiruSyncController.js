/* eslint-disable no-undef */
/* eslint-env node */
// ganti test
const db = require('../db');
const { ikiruFetchHtml, getIkiruAxios, invalidateIkiruSession } = require('../utils/ikiruSession');
const {
  getIkiruCloudflareCookiesFileMeta,
  writeIkiruCloudflareCookiesFile,
  clearIkiruCloudflareCookiesFile,
} = require('../utils/ikiruCloudflareCookiesFile');
const { uploadUrlToS3 } = require('../utils/s3Upload');
const path = require('path');

const BASE_URL = 'https://04.ikiru.wtf';
const SOURCE = 'ikiru';
const MANGA_PATH_REGEX = /\/manga\/([^/?#]+)/i;

let _categoriesCache = null;
let _categoriesCacheAt = 0;
const CATEGORIES_CACHE_TTL_MS = 5 * 60 * 1000;

function cleanText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchHtml(url) {
  const maxAttempts = 5;
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await ikiruFetchHtml(url, { timeout: 25000 });
    } catch (e) {
      lastError = e;
      const status = Number(e?.response?.status || 0);
      const retriableStatus =
        status === 403 ||
        status === 429 ||
        status === 444 ||
        status === 503 ||
        status === 520 ||
        status === 522 ||
        status === 524;
      const retriableNetwork =
        String(e?.message || '').toLowerCase().includes('fetch failed') ||
        String(e?.code || '').toUpperCase() === 'ECONNABORTED';
      if (attempt >= maxAttempts || (!retriableStatus && !retriableNetwork)) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
    }
  }
  throw lastError;
}

function isIkiruUpstreamError(err) {
  const status = Number(err?.response?.status || 0);
  if ([403, 429, 444, 503, 520, 521, 522, 523, 524].includes(status)) return true;
  const msg = String(err?.message || '').toLowerCase();
  return (
    msg.includes('status code 403') ||
    msg.includes('status code 429') ||
    msg.includes('status code 444') ||
    msg.includes('status code 503') ||
    msg.includes('status code 52') ||
    msg.includes('cloudflare') ||
    msg.includes('blocked') ||
    msg.includes('just a moment') ||
    msg.includes('fetch failed') ||
    String(err?.code || '').toUpperCase() === 'ECONNABORTED'
  );
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

function resolveMangaTarget(rawValue, fallbackBaseUrl = BASE_URL) {
  const raw = String(rawValue || '').trim();
  if (!raw) {
    return { slug: '', baseUrl: fallbackBaseUrl, url: null };
  }

  try {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      const parsed = new URL(raw);
      const match = parsed.pathname.match(MANGA_PATH_REGEX);
      const slug = String(match?.[1] || '').trim();
      return {
        slug,
        baseUrl: `${parsed.protocol}//${parsed.host}`,
        url: slug ? `${parsed.protocol}//${parsed.host}/manga/${slug}/` : parsed.toString(),
      };
    }
  } catch {
    // Fall through and treat as plain slug/path.
  }

  const pathMatch = raw.match(MANGA_PATH_REGEX);
  if (pathMatch?.[1]) {
    const slug = String(pathMatch[1]).trim();
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

    const target = resolveMangaTarget(href, BASE_URL);
    const fullHref = target.url || (href.startsWith('http') ? href : BASE_URL + href);
    const slug = target.slug;
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

    const target = resolveMangaTarget(href, BASE_URL);
    const fullHref = target.url || (href.startsWith('http') ? href : BASE_URL + href);
    const slug = target.slug;
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

async function scrapeMangaDetail(slug, { baseUrl = BASE_URL } = {}) {
  const mangaUrl = `${baseUrl}/manga/${slug}/`;
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
      else if (src.startsWith('/')) src = baseUrl + src;
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
      else if (hxGet.startsWith('/')) chapterListUrl = baseUrl + hxGet;
      else chapterListUrl = `${baseUrl}/${hxGet}`;
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
      const fullUrl = href.startsWith('http') ? href : baseUrl + href;
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

async function scrapeChapterImages(mangaSlug, ikiruChapterSlug, { baseUrl = BASE_URL } = {}) {
  const chapterUrl = `${baseUrl}/manga/${mangaSlug}/${ikiruChapterSlug}/`;
  const $ = await fetchHtml(chapterUrl);
  const images = [];
  const seen = new Set();

  const readerSection = $('section[data-image-data="1"]').first();
  const scope = readerSection && readerSection.length ? readerSection : $('body');
  const inReaderSection = Boolean(readerSection && readerSection.length);

  scope.find('img').each((_, el) => {
    let src = $(el).attr('data-src') || $(el).attr('src');
    if (!src) return;
    if (src.startsWith('//')) src = 'https:' + src;
    else if (src.startsWith('/')) src = baseUrl + src;
    src = String(src).trim();
    if (!src) return;

    // Reader section already scopes us to chapter pages, so don't over-filter by host.
    if (!inReaderSection) {
      const lower = src.toLowerCase();
      const isPanelImage =
        lower.includes('cdn.uqni.net/images') ||
        lower.includes('/wp-content/uploads/images/') ||
        lower.match(/\.(webp|jpg|jpeg|png|gif)$/i);
      if (!isPanelImage) return;
    }

    if (seen.has(src)) return;
    seen.add(src);
    images.push(src);
  });

  return { url: chapterUrl, images };
}

/** Stable compare for idempotency (query strings / trailing slashes differ across scrapes). */
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

  // Map scraped order to page_number 1..N (idempotent per page).
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
      const target = resolveMangaTarget(item.url || item.slug, BASE_URL);
      if (!target.slug) {
        throw new Error('Invalid manga slug from feed');
      }

      const localManga = await getMangaBySlugLocal(target.slug);

      if (!localManga) {
        const detail = await scrapeMangaDetail(target.slug, { baseUrl: target.baseUrl });
        const { mangaId } = await upsertMangaFromIkiru(detail, { saveToS3 });
        summary.mangaCreated += 1;

        const mangaRow = await getMangaBySlugLocal(detail.slug);
        const chaptersRes = await insertChaptersIfMissing(mangaRow, detail.chapters, {
          mode: 'all',
        });
        summary.chaptersInserted += chaptersRes.inserted;
        summary.chaptersSkipped += chaptersRes.skipped;
        results.push({
          slug: target.slug,
          action: 'created',
          mangaId,
          chaptersInserted: chaptersRes.inserted,
          chaptersSkipped: chaptersRes.skipped,
        });
      } else {
        summary.mangaSkipped += 1;
        const detail = await scrapeMangaDetail(target.slug, { baseUrl: target.baseUrl });
        // Backfill alternative_name/synopsis (and genres) when they are still empty.
        await upsertMangaFromIkiru(detail, { saveToS3 });
        const chaptersRes = await insertChaptersIfMissing(localManga, detail.chapters, {
          mode: mode === 'delta' ? 'latestOnly' : 'all',
        });
        summary.chaptersInserted += chaptersRes.inserted;
        summary.chaptersSkipped += chaptersRes.skipped;
        results.push({
          slug: target.slug,
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
    if (isIkiruUpstreamError(e)) {
      return res.status(502).json({
        status: false,
        error: `Ikiru upstream unavailable: ${e.message || 'Bad gateway'}`,
      });
    }
    res.status(500).json({ status: false, error: e.message || 'Internal server error' });
  }
};

async function upsertChapterFromIkiru(mangaId, mangaSlug, ch) {
  const localSlug = buildLocalChapterSlug(mangaSlug, ch.slug);
  const chapterTitle = normalizeChapterTitle(ch.title, ch.chapterNumber);
  const chapterNumber =
    ch.chapterNumber !== null && ch.chapterNumber !== undefined ? String(ch.chapterNumber) : null;

  const [existing] = await db.execute(
    'SELECT id, manga_id FROM chapters WHERE slug = ? LIMIT 1',
    [localSlug]
  );
  if (existing.length) {
    const row = existing[0];
    // Slug is globally unique: row may belong to an older duplicate manga row.
    // Reattach to the manga we are syncing so chapter lists + images line up.
    await db.execute(
      'UPDATE chapters SET manga_id = ?, title = ?, chapter_number = ? WHERE id = ?',
      [mangaId, chapterTitle, chapterNumber, row.id]
    );
    return { chapterId: row.id, created: false, slug: localSlug };
  }

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
    const withImages = parseBooleanFlag(req.body?.withImages, false);
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
        const target = resolveMangaTarget(slug, BASE_URL);
        if (!target.slug) {
          throw new Error('Invalid manga slug');
        }
        const detail = await scrapeMangaDetail(target.slug, { baseUrl: target.baseUrl });
        const local = await getMangaBySlugLocal(target.slug);

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

        for (const ch of chaptersToProcess) {
          const { chapterId, created } = await upsertChapterFromIkiru(mangaId, target.slug, ch);
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
// - Dengan withImages=true: scrape + upsert images untuk setiap chapter yang diproses (baru atau sudah ada)
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
      const target = resolveMangaTarget(item.url || item.slug, BASE_URL);
      const slug = target.slug;
      try {
        if (!slug) throw new Error('Invalid manga slug from feed');
        const detail = await scrapeMangaDetail(slug, { baseUrl: target.baseUrl });
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

        for (const ch of chaptersToProcess) {
          const { chapterId, created } = await upsertChapterFromIkiru(mangaId, slug, ch);
          if (created) {
            summary.chaptersCreated += 1;
            chaptersStats.created += 1;
          }
          if (withImages) {
            const { images } = await scrapeChapterImages(slug, ch.slug, {
              baseUrl: target.baseUrl,
            });
            const inserted = await upsertChapterImages(chapterId, images, { saveToS3 });
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

// 1) Init + upsert chapter rows (dan optional images): satu request cukup untuk manga baru.
// POST /api/admin/ikiru-sync/manga/:slug/init { mode, withImages?, saveToS3? }
// - Selalu INSERT/UPDATE baris chapter di DB untuk setiap chapter di plan (mode delta = latest saja).
// - Jika withImages=true, sekalian scrape + upsert chapter_images (set chaptersFullySynced=true).
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
    const mangaUpsert = await upsertMangaFromIkiru(detail, { saveToS3 });
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
        const { chapterId, created } = await upsertChapterFromIkiru(mangaRow.id, slug, ch);
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

// 2) Sync a single chapter (optionally images):
// POST /api/admin/ikiru-sync/manga/:slug/chapter/:chapterSlug
// Body: { title?, chapterNumber?, withImages?, saveToS3? }
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
      if (!detail) detail = await scrapeMangaDetail(slug, { baseUrl: target.baseUrl });
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

const getCloudflareCookiesMeta = async (req, res) => {
  try {
    const meta = getIkiruCloudflareCookiesFileMeta();
    res.json({ status: true, hasCookie: meta.hasCookie, length: meta.length });
  } catch (e) {
    res.status(500).json({ status: false, error: e.message || 'Internal server error' });
  }
};

const putCloudflareCookies = async (req, res) => {
  try {
    const raw = String(req.body?.cookies ?? '').trim();
    if (!raw) {
      clearIkiruCloudflareCookiesFile();
      invalidateIkiruSession();
      return res.json({ status: true, hasCookie: false, message: 'Cookie Cloudflare dihapus.' });
    }
    writeIkiruCloudflareCookiesFile(raw);
    invalidateIkiruSession();
    res.json({ status: true, hasCookie: true, message: 'Cookie Cloudflare disimpan.' });
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
  syncProject,
  cronSyncFeed,
  syncMangaBySlug,
  syncMangaInit,
  syncMangaChapter,
  syncChapterImages,
  getCloudflareCookiesMeta,
  putCloudflareCookies,
};

