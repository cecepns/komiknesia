/* eslint-disable no-undef */
/* eslint-env node */
const axios = require('axios');
const {
  isIkiruCdnUrl,
  isYuuCdnUrl,
  getIkiruCdnFetchHeaders,
  isPromoIkiruResponse,
  isYuuCdnPromoResponse,
  IKIRU_CDN_PROXY,
  YUUCDN_PROXY,
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
      host.includes('komiknesia') ||
      host.includes('kiryuu') ||
      host.includes('localhost') ||
      host.includes('127.0.0.1')
    );
  } catch {
    const lower = urlStr.toLowerCase();
    return (
      lower.includes('ikiru') ||
      lower.includes('06.ikiru.wtf') ||
      lower.includes('komiknesia') ||
      lower.includes('kiryuu') ||
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
async function fetchCdnImageHelper(imageUrl, httpsAgent) {
  const MAX_MANUAL_REDIRECTS = 3;
  let currentUrl = imageUrl;
  const isYuu = isYuuCdnUrl(imageUrl);

  for (let attempt = 0; attempt <= MAX_MANUAL_REDIRECTS; attempt++) {
    let response;
    try {
      response = await axios.get(currentUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        maxRedirects: 0, // handle redirects manually
        validateStatus: (s) => s < 400 || (s >= 300 && s < 400), // allow 3xx
        headers: getIkiruCdnFetchHeaders('https://v6.kiryuu.to/', currentUrl),
        ...(httpsAgent ? { httpsAgent } : {})
      });
    } catch (err) {
      // axios throws on 3xx when maxRedirects:0 — extract Location from error
      const status = err.response?.status;
      if (status && status >= 300 && status < 400) {
        const location = err.response.headers?.location || '';
        if (!location) {
          console.warn(`[fetchCdnImageHelper] 3xx redirect missing Location header at: ${currentUrl}`);
          break;
        }
        const resolvedLocation = location.startsWith('http')
          ? location
          : new URL(location, currentUrl).href;
        
        // If redirected to promo or Cloudflare challenge, bail to promo
        if (isYuu) {
          if (isYuuCdnPromoResponse(resolvedLocation, imageUrl)) {
            console.warn(`[fetchCdnImageHelper] YuuCDN redirect is promo/different: ${resolvedLocation}`);
            return { isPromo: true, isYuuPromo: true };
          }
        } else {
          if (isPromoIkiruResponse(resolvedLocation, imageUrl) || !isIkiruCdnUrl(resolvedLocation)) {
            console.warn(`[fetchCdnImageHelper] Redirected to promo or non-whitelisted URL: ${resolvedLocation}`);
            return { isPromo: true };
          }
        }
        currentUrl = resolvedLocation;
        continue;
      }
      console.warn(`[fetchCdnImageHelper] Axios error fetching ${currentUrl}: ${err.message} (status: ${status})`);
      throw err; // real error, rethrow
    }

    const { status } = response;

    // Successful response
    if (status >= 200 && status < 300) {
      const finalUrl = response.request?.res?.responseUrl || currentUrl;
      if (isYuu) {
        if (isYuuCdnPromoResponse(finalUrl, imageUrl)) {
          console.warn(`[fetchCdnImageHelper] YuuCDN response URL is promo/different: ${finalUrl}`);
          return { isPromo: true, isYuuPromo: true };
        }
      } else {
        if (isPromoIkiruResponse(finalUrl, imageUrl)) {
          console.warn(`[fetchCdnImageHelper] Final response URL is a promo: ${finalUrl}`);
          return { isPromo: true };
        }
      }
      return { isPromo: false, data: response.data, contentType: response.headers['content-type'] };
    }

    // 3xx redirect — inspect Location
    const location = response.headers?.location || '';
    if (!location) {
      console.warn(`[fetchCdnImageHelper] 3xx redirect status ${status} missing Location at: ${currentUrl}`);
      break;
    }
    const resolvedLocation = location.startsWith('http')
      ? location
      : new URL(location, currentUrl).href;

    if (isYuu) {
      if (isYuuCdnPromoResponse(resolvedLocation, imageUrl)) {
        console.warn(`[fetchCdnImageHelper] YuuCDN redirect is promo/different (status ${status}): ${resolvedLocation}`);
        return { isPromo: true, isYuuPromo: true };
      }
    } else {
      if (isPromoIkiruResponse(resolvedLocation, imageUrl) || !isIkiruCdnUrl(resolvedLocation)) {
        console.warn(`[fetchCdnImageHelper] Redirected to promo or non-whitelisted URL (status ${status}): ${resolvedLocation}`);
        return { isPromo: true };
      }
    }
    currentUrl = resolvedLocation;
  }

  console.warn(`[fetchCdnImageHelper] Bailing after max redirects or invalid state for: ${imageUrl}`);
  return { isPromo: true };
}

async function fetchCdnImage(imageUrl) {
  const isYuu = isYuuCdnUrl(imageUrl);

  // Yuu CDN proxy is disabled (fetch directly).
  if (isYuu) {
    console.log(`[fetchCdnImage] Fetching Yuu CDN URL directly (proxy turned off): ${imageUrl}`);
    return fetchCdnImageHelper(imageUrl, null);
  }

  // For other Ikiru CDN hosts, fetch with the standard proxy agent if configured.
  let httpsAgent = null;
  const proxyUrl = IKIRU_CDN_PROXY || process.env.OUTBOUND_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '';
  if (proxyUrl) {
    try {
      const { HttpsProxyAgent } = require('https-proxy-agent');
      httpsAgent = new HttpsProxyAgent(proxyUrl);
    } catch (e) {
      console.error('Failed to create proxy agent:', e.message);
    }
  }

  return fetchCdnImageHelper(imageUrl, httpsAgent);
}

async function proxy(req, res) {
  let targetUrl = '';
  try {
    const rawUrl = req.query.url;
    if (!rawUrl || typeof rawUrl !== 'string') {
      return res.status(400).json({ error: 'Query parameter url is required' });
    }

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
    const isFromIkiru = !referer || checkIkiruDomain(referer) || checkIkiruDomain(origin);

    const fallbackUrl = 'https://is3.cloudhost.id/data.komikneisa/komiknesia/manga/komiknesia-update-/thumbnail-1780155400085.png';

    // Unauthorized visitor → serve fallback image (or redirect YuuCDN directly)
    if (!isFromIkiru) {
      if (isYuuCdnUrl(targetUrl)) {
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.redirect(targetUrl);
      }
      try {
        const fallbackResponse = await axios.get(fallbackUrl, {
          responseType: 'arraybuffer',
          timeout: 10000,
        });
        res.set('Content-Type', fallbackResponse.headers['content-type'] || 'image/png');
        res.set('Cache-Control', 'public, max-age=86400');
        return res.send(Buffer.from(fallbackResponse.data));
      } catch (fallbackErr) {
        console.warn('Failed to fetch fallback image for unauthorized visitor:', fallbackErr.message);
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.redirect(fallbackUrl);
      }
    }

    const result = await fetchCdnImage(targetUrl);

    if (result.isPromo) {
      if (isYuuCdnUrl(targetUrl)) {
        console.log(`[proxy] YuuCDN direct fetch returned promo. Redirecting client to original URL: ${targetUrl}`);
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.redirect(targetUrl);
      }
      try {
        const fallbackResponse = await axios.get(fallbackUrl, {
          responseType: 'arraybuffer',
          timeout: 10000,
        });
        res.set('Content-Type', fallbackResponse.headers['content-type'] || 'image/png');
        res.set('Cache-Control', 'public, max-age=86400');
        return res.send(Buffer.from(fallbackResponse.data));
      } catch (fallbackErr) {
        console.warn('Failed to fetch fallback image:', fallbackErr.message);
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.redirect(fallbackUrl);
      }
    }

    res.set('Content-Type', result.contentType || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=3600');
    return res.send(Buffer.from(result.data));
  } catch (err) {
    console.warn('Image proxy error:', err.message);
    if (targetUrl && isYuuCdnUrl(targetUrl)) {
      console.log(`[proxy] YuuCDN proxy error. Redirecting client to original URL: ${targetUrl}`);
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.redirect(targetUrl);
    }
    const status = err.response?.status;
    return res.status(status && status >= 400 ? status : 502).json({ error: 'Upstream error', message: err.message });
  }
}

module.exports = { proxy };
