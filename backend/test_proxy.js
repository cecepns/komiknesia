const axios = require('axios');

const IKIRU_CDN_ACCESS_CODE = 'NYQLFxYsnOy+/zwnNWmNTUN5';
const DEFAULT_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';

function getIkiruCdnFetchHeaders(referer = 'https://v6.kiryuu.to/') {
  return {
    'User-Agent': DEFAULT_UA,
    'accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'accept-language': 'id,en;q=0.9',
    'access-code': IKIRU_CDN_ACCESS_CODE,
    'cache-control': 'no-cache',
    'pragma': 'no-cache',
    'referer': referer,
    'sec-fetch-dest': 'image',
    'sec-fetch-mode': 'no-cors',
    'sec-fetch-site': 'cross-site',
  };
}

function isIkiruCdnUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return host === 'cdn.itachi.my.id' || host === 'yuucdn.com' || host === 'www.yuucdn.com';
  } catch { return false; }
}

function isPromoIkiruResponse(url) {
  const lower = String(url || '').toLowerCase();
  return lower.includes('promo-ikiru') || lower.includes('promo-kiryuu');
}

async function fetchCdnImage(imageUrl) {
  const MAX_MANUAL_REDIRECTS = 3;
  let currentUrl = imageUrl;

  for (let attempt = 0; attempt <= MAX_MANUAL_REDIRECTS; attempt++) {
    let response;
    try {
      response = await axios.get(currentUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        maxRedirects: 0,
        validateStatus: (s) => s < 400 || (s >= 300 && s < 400),
        headers: getIkiruCdnFetchHeaders(),
      });
    } catch (err) {
      const status = err.response?.status;
      if (status && status >= 300 && status < 400) {
        const location = err.response.headers?.location || '';
        if (!location) break;
        const resolvedLocation = location.startsWith('http') ? location : new URL(location, currentUrl).href;
        if (isPromoIkiruResponse(resolvedLocation) || !isIkiruCdnUrl(resolvedLocation)) {
          return { isPromo: true };
        }
        currentUrl = resolvedLocation;
        continue;
      }
      throw err;
    }

    const { status } = response;
    if (status >= 200 && status < 300) {
      const finalUrl = response.request?.res?.responseUrl || currentUrl;
      if (isPromoIkiruResponse(finalUrl)) return { isPromo: true };
      return { isPromo: false, data: response.data, contentType: response.headers['content-type'] };
    }

    const location = response.headers?.location || '';
    if (!location) break;
    const resolvedLocation = location.startsWith('http') ? location : new URL(location, currentUrl).href;
    if (isPromoIkiruResponse(resolvedLocation) || !isIkiruCdnUrl(resolvedLocation)) return { isPromo: true };
    currentUrl = resolvedLocation;
  }

  return { isPromo: true };
}

async function run() {
  const testUrl = 'https://yuucdn.com/uploads/manga-images/1/100000-layers-of-body-refining-i-raise-all-emperor/chapter-391/14.jpg';
  console.log('Testing:', testUrl);
  try {
    const result = await fetchCdnImage(testUrl);
    if (result.isPromo) {
      console.log('Got promo/redirected image');
    } else {
      console.log('Success! Content-Type:', result.contentType, 'Bytes:', result.data?.length);
    }
  } catch (err) {
    console.error('Error:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
    }
  }
}

run();
