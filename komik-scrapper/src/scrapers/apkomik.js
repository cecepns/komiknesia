const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://01.apkomik.com';
const SOURCE = 'apkomik';
const MANGA_PATH_REGEX = /\/manga\/([^/?#]+)/i;
const DEFAULT_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function cleanText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
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
    'User-Agent': DEFAULT_UA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  try {
    const res = await axios.get(url, { headers, timeout: 25000 });
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
      const slug = String(match?.[1] || '').replace(/\/$/, '').trim();
      return {
        slug,
        baseUrl: `${parsed.protocol}//${parsed.host}`,
        url: slug ? `${parsed.protocol}//${parsed.host}/manga/${slug}/` : parsed.toString(),
      };
    }
  } catch {}

  const pathMatch = raw.match(MANGA_PATH_REGEX);
  if (pathMatch?.[1]) {
    const slug = String(pathMatch[1]).replace(/\/$/, '').trim();
    return { slug, baseUrl: fallbackBaseUrl, url: `${fallbackBaseUrl}/manga/${slug}/` };
  }

  const slug = raw.replace(/^\/+|\/+$/g, '').replace(/^manga\//i, '').trim();
  return { slug, baseUrl: fallbackBaseUrl, url: slug ? `${fallbackBaseUrl}/manga/${slug}/` : null };
}

async function scrapeMangaDetail(slug, baseUrl = BASE_URL) {
  const mangaUrl = `${baseUrl}/manga/${slug}/`;
  const $ = await fetchHtml(mangaUrl);

  const title = cleanText($('.entry-title').first().text()) || cleanText($('h1').first().text()) || slug.replace(/-/g, ' ');

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

  let synopsis = cleanText($('.entry-content p, [itemprop="description"] p').text()) || cleanText($('.entry-content, [itemprop="description"]').text());

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
    if (Number.isFinite(parsedRating) && parsedRating > 0) rating = parsedRating;
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
    const numMatch = chapterSlug.match(/chapter-([\d.]+)/i) || titleText.match(/chapter\s+([\d.]+)/i) || titleText.match(/ch\.\s*([\d.]+)/i) || titleText.match(/([\d.]+)/);
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

async function scrapeChapterImages(chapterUrl, baseUrl = BASE_URL) {
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
