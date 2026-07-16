const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://v6.kiryuu.to';
const SOURCE = 'kiryu';
const MANGA_PATH_REGEX = /\/manga\/([^/?#]+)/i;

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

function slugifyGenre(text) {
  return cleanText(text)
    .toLowerCase()
    .replace(/[’'".]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function fetchHtml(url) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  try {
    const res = await axios.get(url, { headers, timeout: 30000 });
    return cheerio.load(res.data);
  } catch (error) {
    throw new Error(`Gagal mengambil data dari ${url}: ${error.message}`);
  }
}

function resolveMangaTarget(rawValue, fallbackBaseUrl = BASE_URL) {
  const raw = String(rawValue || '').trim();
  if (!raw) return { slug: '', baseUrl: fallbackBaseUrl, url: null };

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
  } catch {}

  const pathMatch = raw.match(MANGA_PATH_REGEX);
  if (pathMatch?.[1]) {
    const slug = String(pathMatch[1]).trim();
    return { slug, baseUrl: fallbackBaseUrl, url: `${fallbackBaseUrl}/manga/${slug}/` };
  }

  const slug = raw.replace(/^\/+|\/+$/g, '').replace(/^manga\//i, '').trim();
  return { slug, baseUrl: fallbackBaseUrl, url: slug ? `${fallbackBaseUrl}/manga/${slug}/` : null };
}

function parseIkiruMangaType($) {
  const iconSrc = $('img[src*="manhwa.svg"], img[src*="manhua.svg"], img[src*="manga.svg"], img[src*="comic.svg"]').first().attr('src') || '';
  const iconType = normalizeContentType(iconSrc);
  if (iconType) return iconType;

  const candidates = [];
  $('h4, span').each((_, el) => {
    const label = cleanText($(el).text()).toLowerCase();
    if (label !== 'type') return;
    const row = $(el).closest('div');
    const rowText = cleanText(row.text());
    const parsed = normalizeContentType(rowText);
    if (parsed) candidates.push(parsed);
  });

  if (candidates.length) return candidates[0];
  return null;
}

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
  return null;
}

async function scrapeMangaDetail(slug, baseUrl = BASE_URL) {
  const mangaUrl = `${baseUrl}/manga/${slug}/`;
  const $ = await fetchHtml(mangaUrl);

  const titleEl = $('[itemprop="name"]').first();
  const title = cleanText(titleEl.text()) || cleanText($('h1').first().text()) || cleanText($('h2').first().text()) || slug.replace(/-/g, ' ');

  let alternativeName = '';
  if (titleEl && titleEl.length) {
    const parent = titleEl.parent();
    alternativeName = cleanText(titleEl.next('div').first().text());
    if (!alternativeName) alternativeName = cleanText(parent.find('div.line-clamp-1').first().text());
    if (!alternativeName) {
      alternativeName = cleanText(
        parent.find('div').filter((_, el) => {
            const $el = $(el);
            const t = cleanText($el.text());
            if (!t) return false;
            if ($el.attr('itemprop')) return false;
            return true;
          }).first().text()
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

  let synopsis = '';
  const descEl = $('div[itemprop="description"]').first();
  if (descEl && descEl.length) {
    synopsis = cleanText(descEl.find('p').first().text() || descEl.text());
    synopsis = synopsis.replace(/\s*baca\s+cuma\s+di\s*ikiru\.id\.?\s*$/i, '').trim();
  } else {
    const synopsisHeader = $('h3, h4').filter((_, el) => cleanText($(el).text()).toLowerCase() === 'synopsis').first();
    if (synopsisHeader.length) {
      synopsis = cleanText(synopsisHeader.parent().text().replace(/Synopsis/i, ''));
    }
  }

  const genres = new Set();
  $('a[href*="/genre/"], a[href*="/genres/"]').each((_, el) => {
    const a = $(el);
    const href = a.attr('href') || '';
    const txt = cleanText(a.text());
    const slugFromHref = href.split('?')[0].split('/').filter(Boolean).pop();
    const gSlug = slugFromHref ? slugifyGenre(slugFromHref) : slugifyGenre(txt);
    if (gSlug) genres.add(gSlug);
  });

  const chapters = [];
  const chapterListEl = $('#chapter-list');
  if (chapterListEl && chapterListEl.length) {
    const rawHxGet = chapterListEl.attr('hx-get') || chapterListEl.attr('data-hx-get') || chapterListEl.attr('data-hxGet') || chapterListEl.attr('hxGet');

    let chapterDoc = $;
    if (rawHxGet) {
      const hxGet = rawHxGet.trim();
      let chapterListUrl;
      if (hxGet.startsWith('http')) chapterListUrl = hxGet;
      else if (hxGet.startsWith('//')) chapterListUrl = 'https:' + hxGet;
      else if (hxGet.startsWith('/')) chapterListUrl = baseUrl + hxGet;
      else chapterListUrl = `${baseUrl}/${hxGet}`;
      try {
        chapterDoc = await fetchHtml(chapterListUrl);
      } catch {}
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
        const numMatch = chapterSlug.match(/chapter-([\d.]+)/i) || text.match(/chapter\s+([\d.]+)/i);
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
  const contentType = parseIkiruMangaType($);

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

async function scrapeChapterImages(chapterUrl, baseUrl = BASE_URL) {
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

    if (!inReaderSection) {
      const lower = src.toLowerCase();
      const isPanelImage = lower.includes('cdn.uqni.net/images') || lower.includes('/wp-content/uploads/images/') || lower.match(/\.(webp|jpg|jpeg|png|gif)$/i);
      if (!isPanelImage) return;
    }

    if (seen.has(src)) return;
    seen.add(src);
    images.push(src);
  });

  return images;
}

async function scrapeMangaList(listUrl) {
  const $ = await fetchHtml(listUrl);
  const list = [];
  const seen = new Set();

  const selectors = [
    '.listupd .bsx a',
    '.listupd .bs a',
    '.listupd .utao a',
    '.listupd .soralist a',
    '#content .bsx a',
    'main .bsx a'
  ];

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!href) return;
      
      const target = resolveMangaTarget(href);
      if (target.slug && !seen.has(target.slug)) {
        seen.add(target.slug);
        
        let title = cleanText($(el).find('.tt').text()) || 
                    cleanText($(el).find('.tt').first().text()) || 
                    cleanText($(el).attr('title')) || 
                    cleanText($(el).find('img').attr('alt')) || 
                    target.slug.replace(/-/g, ' ');
                    
        list.push({
          title,
          slug: target.slug,
          url: target.url || href,
        });
      }
    });
    if (list.length > 0) break;
  }

  if (list.length === 0) {
    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!href) return;
      
      const target = resolveMangaTarget(href);
      if (target.slug && !seen.has(target.slug)) {
        seen.add(target.slug);
        const title = cleanText($(el).text()) || target.slug.replace(/-/g, ' ');
        list.push({
          title,
          slug: target.slug,
          url: target.url || href,
        });
      }
    });
  }

  return list;
}

module.exports = {
  SOURCE,
  resolveMangaTarget,
  scrapeMangaDetail,
  scrapeChapterImages,
  scrapeMangaList,
};
