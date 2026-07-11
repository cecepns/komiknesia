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

const IKIRU_CDN_PROXY =
  process.env.IKIRU_CDN_PROXY || 'http://jlqhqvqf:2q5jwr526cph@45.43.70.75:6362';

// Rotating residential proxy — used for YuuCDN which blocks datacenter IPs.
// Residential IPs bypass Cloudflare bot protection on yuucdn.com.
const YUUCDN_PROXY =
  process.env.YUUCDN_PROXY || process.env.IKIRU_CDN_PROXY || 'http://jlqhqvqf-rotate:2q5jwr526cph@p.webshare.io:80';

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

function isYuuCdnUrl(url) {
  if (!url) return false;
  try {
    const href = String(url).trim().startsWith('//') ? `https:${url}` : String(url).trim();
    const u = new URL(href);
    const host = u.hostname.toLowerCase();
    return host === 'yuucdn.com' || host === 'www.yuucdn.com';
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

function isYuuCdnPromoResponse(url, originalUrl = '') {
  if (!url || !originalUrl) return false;
  const lower = String(url).toLowerCase();
  const origLower = String(originalUrl).toLowerCase();

  // If final URL is explicitly a promo image
  if (
    lower.includes('promo-ikiru') ||
    lower.includes('promo-kiryuu') ||
    lower.includes('promo-kiryuu-moon.png') ||
    lower.includes('promo-kiryuu.png')
  ) {
    return true;
  }

  // Or not the original URL (e.g. redirected to another path/file)
  try {
    const finalParsed = new URL(url);
    const originalParsed = new URL(originalUrl);
    if (finalParsed.pathname.toLowerCase() !== originalParsed.pathname.toLowerCase()) {
      return true;
    }
  } catch {
    if (lower !== origLower) {
      return true;
    }
  }

  return false;
}

function getIkiruCdnFetchHeaders(referer = IKIRU_ORIGIN, targetUrl = '') {
  const ref = String(referer || IKIRU_ORIGIN).replace(/\/+$/, '');

  let host = '';
  if (targetUrl) {
    try {
      const u = new URL(targetUrl);
      host = u.hostname.toLowerCase();
    } catch { }
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
  return imagePath;
}

module.exports = {
  IKIRU_CDN_HOSTS,
  isIkiruCdnUrl,
  isYuuCdnUrl,
  isPromoIkiruResponse,
  isYuuCdnPromoResponse,
  getIkiruCdnFetchHeaders,
  toProxiedImagePathIfNeeded,
  IKIRU_CDN_PROXY,
  YUUCDN_PROXY,
};
