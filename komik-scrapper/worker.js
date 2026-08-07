/**
 * Cloudflare Worker - Auto Scrapper & Cron Trigger
 * Komiknesia Scrapper
 */

import * as cheerio from 'cheerio';

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

async function checkChapterExistsInBackend(apiBaseUrl, localSlug) {
  try {
    const apiBase = apiBaseUrl.replace(/\/api\/(admin\/)?scrapper-sync\/sync.*$/, '');
    const checkUrl = `${apiBase}/api/chapters/slug/${encodeURIComponent(localSlug)}`;
    const res = await fetch(checkUrl);
    if (res.status === 200) {
      const data = await res.json();
      return !!data.status;
    }
  } catch (e) {
    console.warn(`[Worker] Check chapter error:`, e.message);
  }
  return false;
}

async function scrapeApkomikList(pageUrl) {
  const res = await fetch(pageUrl, { headers: { 'User-Agent': DEFAULT_UA } });
  const html = await res.text();
  const $ = cheerio.load(html);

  const list = [];
  const seen = new Set();
  const selectors = ['.listupd .bsx a', '.listupd .bs a', '.listupd .utao a', '#content .bsx a'];

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const href = $(el).attr('href') || '';
      const match = href.match(/\/manga\/([^/?#]+)/i);
      if (match && match[1]) {
        const slug = match[1].replace(/\/$/, '').trim();
        if (!seen.has(slug)) {
          seen.add(slug);
          const title = cleanText($(el).find('.tt').text()) || cleanText($(el).attr('title')) || slug.replace(/-/g, ' ');
          list.push({ title, slug, url: href.startsWith('http') ? href : `https://01.apkomik.com/manga/${slug}/` });
        }
      }
    });
    if (list.length > 0) break;
  }
  return list;
}

async function scrapeApkomikDetail(slug, baseUrl = 'https://01.apkomik.com') {
  const mangaUrl = `${baseUrl}/manga/${slug}/`;
  const res = await fetch(mangaUrl, { headers: { 'User-Agent': DEFAULT_UA } });
  const html = await res.text();
  const $ = cheerio.load(html);

  const title = cleanText($('.entry-title').first().text()) || slug.replace(/-/g, ' ');
  let coverImage = $('.thumb img').first().attr('src') || $('.thumb img').first().attr('data-src');
  if (coverImage && coverImage.startsWith('//')) coverImage = 'https:' + coverImage;

  const synopsis = cleanText($('.entry-content p, [itemprop="description"] p').text());

  const genres = new Set();
  $('.mgen a').each((_, el) => {
    const gSlug = slugifyGenre($(el).text());
    if (gSlug) genres.add(gSlug);
  });

  const chapters = [];
  $('#chapterlist ul li, .cl ul li').each((_, el) => {
    const linkEl = $(el).find('a').first();
    const href = linkEl.attr('href') || '';
    if (!href) return;
    const chapterSlug = href.split('/').filter(Boolean).pop();
    const titleText = linkEl.find('.chapternum').text().trim() || linkEl.text().trim();
    const numMatch = chapterSlug.match(/chapter-([\d.]+)/i) || titleText.match(/chapter\s+([\d.]+)/i);
    chapters.push({
      title: titleText || chapterSlug,
      url: href.startsWith('http') ? href : baseUrl + href,
      slug: chapterSlug,
      chapterNumber: numMatch ? parseFloat(numMatch[1]) : null,
    });
  });

  return { slug, title, coverImage, synopsis, genres: Array.from(genres), chapters };
}

async function scrapeApkomikChapterImages(chapterUrl) {
  const res = await fetch(chapterUrl, { headers: { 'User-Agent': DEFAULT_UA } });
  const html = await res.text();
  const $ = cheerio.load(html);
  const images = [];

  $('script').each((_, el) => {
    const text = $(el).text();
    if (text.includes('ts_reader.run')) {
      const match = text.match(/ts_reader\.run\((.*?)\);/);
      if (match && match[1]) {
        try {
          const data = JSON.parse(match[1]);
          if (data.sources?.[0]?.images) {
            for (let src of data.sources[0].images) {
              if (src.startsWith('//')) src = 'https:' + src;
              images.push(src);
            }
          }
        } catch {}
      }
    }
  });

  if (images.length === 0) {
    $('#readerarea img').each((_, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src');
      if (src) {
        if (src.startsWith('//')) src = 'https:' + src;
        images.push(src);
      }
    });
  }
  return images;
}

async function uploadImageToR2(env, key, imageUrl, referer = 'https://01.apkomik.com/') {
  if (env.MY_BUCKET) {
    const head = await env.MY_BUCKET.head(key);
    if (head) {
      const publicDomain = (env.S3_PUBLIC_DOMAIN || '').replace(/\/$/, '');
      return publicDomain ? `${publicDomain}/${key}` : `/${key}`;
    }
  }

  const imgRes = await fetch(imageUrl, {
    headers: { 'User-Agent': DEFAULT_UA, 'Referer': referer }
  });
  if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status} fetching image`);

  const arrayBuffer = await imgRes.arrayBuffer();
  const contentType = imgRes.headers.get('content-type') || 'image/jpeg';

  if (env.MY_BUCKET) {
    await env.MY_BUCKET.put(key, arrayBuffer, { httpMetadata: { contentType } });
  }

  const publicDomain = (env.S3_PUBLIC_DOMAIN || '').replace(/\/$/, '');
  return publicDomain ? `${publicDomain}/${key}` : `/${key}`;
}

async function processAutoScrap(env, targetPageUrl) {
  const pageUrl = targetPageUrl || 'https://01.apkomik.com/manhwa-terbaru';
  const backendApiUrl = env.KOMIKNESIA_API_URL;
  const secret = env.KOMIKNESIA_API_SECRET;

  console.log(`[Worker] Starting auto scrap for ${pageUrl}...`);
  const mangaList = await scrapeApkomikList(pageUrl);
  const summary = [];

  for (let i = 0; i < mangaList.length; i++) {
    const item = mangaList[i];
    try {
      const detail = await scrapeApkomikDetail(item.slug);
      if (!detail.chapters || detail.chapters.length === 0) continue;

      const latestCh = detail.chapters[0];
      const localSlug = latestCh.slug.startsWith(`${detail.slug}-`) ? latestCh.slug : `${detail.slug}-${latestCh.slug}`;

      // KONDISI SKIP CHAPTER JIKA SUDAH ADA DI DB
      const exists = await checkChapterExistsInBackend(backendApiUrl, localSlug);
      if (exists) {
        console.log(`[SKIP] ${detail.slug} ${latestCh.title} already exists in DB.`);
        summary.push({ slug: detail.slug, chapter: latestCh.title, status: 'skipped' });
        continue;
      }

      console.log(`[NEW] Processing ${detail.slug} ${latestCh.title}...`);

      // Scrape images
      const images = await scrapeApkomikChapterImages(latestCh.url);
      const r2Images = [];
      for (let j = 0; j < images.length; j++) {
        const ext = images[j].split('?')[0].split('.').pop() || 'webp';
        const key = `komiknesia/apkomik/chapters/${detail.slug}/${latestCh.slug}/pages/${j + 1}.${ext}`;
        try {
          const r2Url = await uploadImageToR2(env, key, images[j]);
          r2Images.push(r2Url);
        } catch {
          r2Images.push(images[j]);
        }
      }

      // Payload to Backend
      const payload = {
        source: 'apkomik',
        mangaDetail: {
          title: detail.title,
          slug: detail.slug,
          synopsis: detail.synopsis,
          coverImage: detail.coverImage,
          genres: detail.genres,
        },
        chapters: [{
          slug: latestCh.slug,
          title: latestCh.title,
          chapterNumber: latestCh.chapterNumber,
          images: r2Images,
        }],
      };

      const syncRes = await fetch(backendApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secret}`,
        },
        body: JSON.stringify(payload),
      });

      const syncData = await syncRes.json();
      summary.push({ slug: detail.slug, chapter: latestCh.title, status: 'synced', result: syncData });

    } catch (err) {
      console.error(`Error processing ${item.slug}:`, err.message);
      summary.push({ slug: item.slug, status: 'error', error: err.message });
    }
  }

  return summary;
}

export default {
  // HTTP Fetch Event
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pageUrl = url.searchParams.get('page') || 'https://01.apkomik.com/manhwa-terbaru';

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), { headers: { 'Content-Type': 'application/json' } });
    }

    try {
      const summary = await processAutoScrap(env, pageUrl);
      return new Response(JSON.stringify({ success: true, count: summary.length, summary }, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  },

  // Cron Trigger Scheduled Event
  async scheduled(event, env, ctx) {
    ctx.waitUntil(processAutoScrap(env, 'https://01.apkomik.com/manhwa-terbaru'));
  },
};
