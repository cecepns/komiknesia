/* eslint-disable no-undef */
/* eslint-env node */
const axios = require('axios');
const {
  isIkiruCdnUrl,
  getIkiruCdnFetchHeaders,
  isPromoIkiruResponse,
} = require('../utils/ikiruCdnImage');

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

    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxRedirects: 5,
      headers: getIkiruCdnFetchHeaders(),
    });

    const finalUrl = response.request?.res?.responseUrl || targetUrl;
    if (isPromoIkiruResponse(finalUrl)) {
      return res.status(502).json({ error: 'Upstream returned promo image' });
    }

    const contentType = response.headers['content-type'] || 'image/jpeg';
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=3600');
    return res.send(Buffer.from(response.data));
  } catch (err) {
    console.warn('Image proxy error:', err.message);
    const status = err.response?.status;
    return res.status(status && status >= 400 ? status : 502).json({ error: 'Upstream error' });
  }
}

module.exports = { proxy };
