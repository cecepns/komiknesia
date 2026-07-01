/* eslint-disable no-undef */
/* eslint-env node */
/**
 * Ikiru CDN (cdn.itachi.my.id) requires access-code + referer headers.
 * Without them the CDN 302-redirects to promo-ikiru.webp.
 */
const { IKIRU_ORIGIN } = require('./ikiruSession');

const { readIkiruCloudflareCookiesSync } = require('./ikiruCloudflareCookiesFile');

const IKIRU_CDN_HOSTS = new Set(['cdn.itachi.my.id', 'yuucdn.com', 'www.yuucdn.com']);

const IKIRU_CDN_ACCESS_CODE =
  process.env.IKIRU_CDN_ACCESS_CODE || 'NYQLFxYsnOy+/zwnNWmNTUN5';

const IKIRU_CDN_PROXY = 'http://jlqhqvqf-rotate:2q5jwr526cph@p.webshare.io:80';

const DEFAULT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';

function isIkiruCdnUrl(url) {
  if (!url) return false;
  try {
    const href = String(url).trim().startsWith('//') ? `https:${url}` : String(url).trim();
    const u = new URL(href);
    return IKIRU_CDN_HOSTS.has(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function isPromoIkiruResponse(url, originalUrl = '') {
  const lower = String(url || '').toLowerCase();
  const originalLower = String(originalUrl || '').toLowerCase();
  if (originalLower.includes('promo-ikiru') || originalLower.includes('promo-kiryuu')) {
    return false;
  }
  return lower.includes('promo-ikiru') || lower.includes('promo-kiryuu');
}

function getIkiruCdnFetchHeaders(referer = IKIRU_ORIGIN, targetUrl = '') {
  const ref = String(referer || IKIRU_ORIGIN).replace(/\/+$/, '');
  
  let host = '';
  if (targetUrl) {
    try {
      const u = new URL(targetUrl);
      host = u.hostname.toLowerCase();
    } catch {}
  }

  // Do not send Cloudflare cookies if the target is yuucdn.com
  const cfCookie = (host === 'yuucdn.com' || host === 'www.yuucdn.com')
    ? ''
    : readIkiruCloudflareCookiesSync();

  return {
    'User-Agent': DEFAULT_UA,
    accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'accept-language': 'id,en;q=0.9',
    'access-code': IKIRU_CDN_ACCESS_CODE,
    'cache-control': 'no-cache',
    pragma: 'no-cache',
    referer: `${ref}/`,
    'sec-ch-ua': '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'image',
    'sec-fetch-mode': 'no-cors',
    'sec-fetch-site': 'cross-site',
    'sec-fetch-storage-access': 'active',
    ...(cfCookie ? { Cookie: cfCookie } : {}),
  };
}

function toProxiedImagePathIfNeeded(imagePath, req) {
  if (!imagePath || typeof imagePath !== 'string') return imagePath;
  const trimmed = imagePath.trim();
  if (!trimmed) return imagePath;
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return imagePath;
  if (!isIkiruCdnUrl(trimmed)) return imagePath;

  const host = req.get('host');
  const base = host ? `${req.protocol}://${host}` : '';
  if (!base) return imagePath;

  return `${base}/api/image-proxy?url=${encodeURIComponent(trimmed)}`;
}

module.exports = {
  IKIRU_CDN_HOSTS,
  isIkiruCdnUrl,
  isPromoIkiruResponse,
  getIkiruCdnFetchHeaders,
  toProxiedImagePathIfNeeded,
  IKIRU_CDN_PROXY,
};
