/* eslint-disable no-undef */
/* eslint-env node */
const axios = require('axios');
const {
  isIkiruCdnUrl,
  getIkiruCdnFetchHeaders,
  isPromoIkiruResponse,
} = require('../utils/ikiruCdnImage');

function checkIkiruDomain(urlStr) {
  if (!urlStr) return false;
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    return (
      host === '06.ikiru.wtf' ||
      host === 'ikiru.wtf' ||
      host.endsWith('.ikiru.wtf') ||
      host.includes('ikiru') ||
      host.includes('localhost') ||
      host.includes('127.0.0.1')
    );
  } catch {
    const lower = urlStr.toLowerCase();
    return (
      lower.includes('ikiru') ||
      lower.includes('06.ikiru.wtf') ||
      lower.includes('localhost') ||
      lower.includes('127.0.0.1')
    );
  }
}

/**
 * Fetch an image from cdn.itachi.my.id with correct headers.
 * Uses maxRedirects:0 so we can inspect Location header ourselves.
 * If CDN redirects to promo or Cloudflare challenge, we fall back
 * to serving the promo image directly.
 */
async function fetchCdnImage(imageUrl) {
  const MAX_MANUAL_REDIRECTS = 3;
  let currentUrl = imageUrl;

  for (let attempt = 0; attempt <= MAX_MANUAL_REDIRECTS; attempt++) {
    let response;
    try {
      response = await axios.get(currentUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        maxRedirects: 0, // handle redirects manually
        validateStatus: (s) => s < 400 || (s >= 300 && s < 400), // allow 3xx
        headers: getIkiruCdnFetchHeaders('https://v6.kiryuu.to/'),
      });
    } catch (err) {
      // axios throws on 3xx when maxRedirects:0 — extract Location from error
      const status = err.response?.status;
      if (status && status >= 300 && status < 400) {
        const location = err.response.headers?.location || '';
        if (!location) break;
        const resolvedLocation = location.startsWith('http')
          ? location
          : new URL(location, currentUrl).href;
        // If redirected to promo or Cloudflare challenge, bail to promo
        if (isPromoIkiruResponse(resolvedLocation) || !isIkiruCdnUrl(resolvedLocation)) {
          return { isPromo: true };
        }
        currentUrl = resolvedLocation;
        continue;
      }
      throw err; // real error, rethrow
    }

    const { status } = response;

    // Successful response
    if (status >= 200 && status < 300) {
      const finalUrl = response.request?.res?.responseUrl || currentUrl;
      if (isPromoIkiruResponse(finalUrl)) {
        return { isPromo: true };
      }
      return { isPromo: false, data: response.data, contentType: response.headers['content-type'] };
    }

    // 3xx redirect — inspect Location
    const location = response.headers?.location || '';
    if (!location) break;
    const resolvedLocation = location.startsWith('http')
      ? location
      : new URL(location, currentUrl).href;

    if (isPromoIkiruResponse(resolvedLocation) || !isIkiruCdnUrl(resolvedLocation)) {
      return { isPromo: true };
    }
    currentUrl = resolvedLocation;
  }

  // Too many redirects or no valid redirect — fall back to promo
  return { isPromo: true };
}

async function proxy(req, res) {
  try {
    const rawUrl = req.query.url;
    if (!rawUrl || typeof rawUrl !== 'string') {
      return res.status(400).json({ error: 'Query parameter url is required' });
    }

    let targetUrl;
    try {
      targetUrl = decodeURIComponent(rawUrl.trim());
      const parsed = new URL(targetUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return res.status(400).json({ error: 'Invalid url' });
      }
    } catch {
      return res.status(400).json({ error: 'Invalid url' });
    }

    if (!isIkiruCdnUrl(targetUrl)) {
      return res.status(403).json({ error: 'URL host not allowed for proxy' });
    }

    const referer = req.headers.referer || req.headers.referrer || '';
    const origin = req.headers.origin || '';
    const isFromIkiru = checkIkiruDomain(referer) || checkIkiruDomain(origin);

    // Unauthorized visitor → serve promo image
    if (!isFromIkiru) {
      targetUrl = 'https://cdn.itachi.my.id/promo-ikiru.webp';
    }

    const result = await fetchCdnImage(targetUrl);

    if (result.isPromo) {
      // Fetch and pipe promo image
      const promoResult = await fetchCdnImage('https://cdn.itachi.my.id/promo-ikiru.webp');
      if (!promoResult.isPromo && promoResult.data) {
        res.set('Content-Type', promoResult.contentType || 'image/webp');
        res.set('Cache-Control', 'public, max-age=3600');
        return res.send(Buffer.from(promoResult.data));
      }
      // Last resort: redirect to promo
      return res.redirect('https://cdn.itachi.my.id/promo-ikiru.webp');
    }

    res.set('Content-Type', result.contentType || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=3600');
    return res.send(Buffer.from(result.data));
  } catch (err) {
    console.warn('Image proxy error:', err.message);
    const status = err.response?.status;
    return res.status(status && status >= 400 ? status : 502).json({ error: 'Upstream error', message: err.message });
  }
}

module.exports = { proxy };
