export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Only allow GET requests
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Determine the target URL to proxy.
    // Supports both:
    // 1. Query parameter: /?url=https://yuucdn.com/path/to/image.jpg
    // 2. Path-based: /path/to/image.jpg
    let targetUrlStr = url.searchParams.get('url');

    if (targetUrlStr) {
      try {
        targetUrlStr = decodeURIComponent(targetUrlStr.trim());
        const parsedTarget = new URL(targetUrlStr);
        // Validate host is YuuCDN
        const host = parsedTarget.hostname.toLowerCase();
        if (host !== 'yuucdn.com' && host !== 'www.yuucdn.com') {
          return new Response('Only yuucdn.com is allowed', { status: 403 });
        }
      } catch {
        return new Response('Invalid target URL parameter', { status: 400 });
      }
    } else {
      // If no path and no url parameter, return health check
      if (url.pathname === '/' || url.pathname === '') {
        return new Response('YuuCDN Cloudflare Worker Proxy is Running. Usage: /?url=<yuucdn-url> or /<image-path>', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      const targetUrl = new URL(request.url);
      targetUrl.hostname = 'yuucdn.com';
      targetUrl.protocol = 'https:';
      targetUrlStr = targetUrl.toString();
    }

    const cache = caches.default;
    // Construct a clean cache key using the final target URL
    const cacheKey = new Request(targetUrlStr, {
      method: 'GET',
    });

    // Check Cloudflare Cache first
    let response = await cache.match(cacheKey);
    if (response) {
      const newHeaders = new Headers(response.headers);
      newHeaders.set('X-Proxy-Cache', 'HIT');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    }

    const headers = new Headers({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'accept-language': 'id,en;q=0.9',
      'access-code': env.ACCESS_CODE || 'NYQLFxYsnOy+/zwnNWmNTUN5',
      'referer': env.REFERER || 'https://v6.kiryuu.to/',
      'cache-control': 'no-cache',
      'pragma': 'no-cache',
    });

    let currentUrl = targetUrlStr;
    let fetchResponse = null;
    const MAX_REDIRECTS = 3;

    try {
      for (let i = 0; i <= MAX_REDIRECTS; i++) {
        fetchResponse = await fetch(currentUrl, {
          method: 'GET',
          headers: headers,
          redirect: 'manual',
        });

        const status = fetchResponse.status;
        if (status >= 300 && status < 400) {
          const location = fetchResponse.headers.get('location') || '';
          if (!location) {
            break;
          }
          const resolvedLocation = location.startsWith('http')
            ? location
            : new URL(location, currentUrl).toString();

          const lowerLoc = resolvedLocation.toLowerCase();
          // Detect promo/watermark redirects
          if (
            lowerLoc.includes('promo-ikiru') ||
            lowerLoc.includes('promo-kiryuu') ||
            lowerLoc.includes('promo-kiryuu-moon.png') ||
            lowerLoc.includes('promo-kiryuu.png')
          ) {
            console.warn(`[YuuCDN Worker] Redirected to promo URL: ${resolvedLocation}`);
            return new Response('Blocked or Redirected to Promo by YuuCDN', {
              status: 403,
              headers: { 'Content-Type': 'text/plain' },
            });
          }

          currentUrl = resolvedLocation;
          continue;
        }
        break;
      }

      if (!fetchResponse) {
        return new Response('Bad Gateway', { status: 502 });
      }

      const finalUrlLower = currentUrl.toLowerCase();
      if (
        finalUrlLower.includes('promo-ikiru') ||
        finalUrlLower.includes('promo-kiryuu') ||
        finalUrlLower.includes('promo-kiryuu-moon.png') ||
        finalUrlLower.includes('promo-kiryuu.png')
      ) {
        return new Response('Blocked or Redirected to Promo by YuuCDN', {
          status: 403,
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      // If successful, cache and return
      if (fetchResponse.status === 200) {
        let responseToCache = new Response(fetchResponse.body, fetchResponse);
        responseToCache.headers.set('Cache-Control', 'public, max-age=604800'); // Cache for 7 days
        responseToCache.headers.set('Access-Control-Allow-Origin', '*');
        responseToCache.headers.set('X-Proxy-Cache', 'MISS');

        // Store the response in the cache
        ctx.waitUntil(cache.put(cacheKey, responseToCache.clone()));

        return responseToCache;
      }

      return fetchResponse;
    } catch (err) {
      return new Response(`Proxy Error: ${err.message}`, { status: 502 });
    }
  },
};
